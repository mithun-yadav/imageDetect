import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  NotFoundException,
} from '@nestjs/common';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { GetDetectionsQueryDto } from './dto/get-detections-query.dto.js';

import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { performance } from 'node:perf_hooks';

import type { Express } from 'express';

interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface InferenceResponse {
  success: boolean;
  filename: string;
  model: string;
  confidence_threshold: number;
  processing_time_ms: number;
  result: {
    image_width: number;
    image_height: number;
    total_detections: number;
    detections: Detection[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidInferenceResponse(value: unknown): value is InferenceResponse {
  if (!isRecord(value) || value.success !== true) {
    return false;
  }

  if (
    !isNonEmptyString(value.filename) ||
    !isNonEmptyString(value.model) ||
    !isFiniteNumber(value.confidence_threshold) ||
    value.confidence_threshold < 0 ||
    value.confidence_threshold > 1 ||
    !isFiniteNumber(value.processing_time_ms) ||
    value.processing_time_ms < 0
  ) {
    return false;
  }

  const result = value.result;

  if (
    !isRecord(result) ||
    !Number.isInteger(result.image_width) ||
    (result.image_width as number) <= 0 ||
    !Number.isInteger(result.image_height) ||
    (result.image_height as number) <= 0 ||
    !Number.isInteger(result.total_detections) ||
    (result.total_detections as number) < 0 ||
    !Array.isArray(result.detections) ||
    result.detections.length !== result.total_detections
  ) {
    return false;
  }

  return result.detections.every((detection: unknown) => {
    if (!isRecord(detection)) {
      return false;
    }

    if (
      !Number.isInteger(detection.class_id) ||
      (detection.class_id as number) < 0 ||
      !isNonEmptyString(detection.class_name) ||
      !isFiniteNumber(detection.confidence) ||
      detection.confidence < 0 ||
      detection.confidence > 1 ||
      !isRecord(detection.bbox)
    ) {
      return false;
    }

    const { x1, y1, x2, y2 } = detection.bbox;

    return (
      isFiniteNumber(x1) &&
      isFiniteNumber(y1) &&
      isFiniteNumber(x2) &&
      isFiniteNumber(y2) &&
      x1 >= 0 &&
      y1 >= 0 &&
      x2 <= (result.image_width as number) &&
      y2 <= (result.image_height as number) &&
      x1 < x2 &&
      y1 < y2
    );
  });
}

@Injectable()
export class DetectionService {
  private readonly inferenceUrl =
    process.env.INFERENCE_BASE_URL ?? 'http://127.0.0.1:8000';

  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async recordInferenceMetric(data: {
    status: 'SUCCESS' | 'FAILED';
    modelName?: string;
    processingTimeMs?: number;
    requestDurationMs: number;
    httpStatus?: number;
    errorCode?: string;
  }): Promise<void> {
    try {
      await this.prisma.inferenceMetric.create({
        data,
      });
    } catch (error) {
      // Monitoring must never affect the detection workflow.
      this.logger.warn(
        `Failed to record inference metric: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async persistDetection(
    file: Express.Multer.File,
    response: InferenceResponse,
  ): Promise<void> {
    const storageKey = await this.storage.save(file.buffer, file.mimetype);

    try {
      await this.prisma.detection.create({
        data: {
          originalFilename: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          fileSizeBytes: file.buffer.length,

          model: response.model,
          confidenceThreshold: response.confidence_threshold,
          processingTimeMs: response.processing_time_ms,

          imageWidth: response.result.image_width,
          imageHeight: response.result.image_height,
          totalDetections: response.result.total_detections,

          detections: {
            create: response.result.detections.map((item) => ({
              classId: item.class_id,
              className: item.class_name,
              confidence: item.confidence,
              x1: item.bbox.x1,
              y1: item.bbox.y1,
              x2: item.bbox.x2,
              y2: item.bbox.y2,
            })),
          },
        },
      });
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up image ${storageKey} after database persistence failure`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      }

      this.logger.error(
        'Failed to persist detection result',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('Unable to save detection result');
    }
  }

  async findAll(query: GetDetectionsQueryDto) {
    const { page, limit, search, className, model, dateFrom, dateTo } = query;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException(
        'dateFrom must be before or equal to dateTo',
      );
    }

    const skip = (page - 1) * limit;

    const where = {
      ...(search?.trim()
        ? {
            originalFilename: {
              contains: search.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),

      ...(className?.trim()
        ? {
            detections: {
              some: {
                className: {
                  equals: className.trim(),
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : {}),

      ...(model?.trim()
        ? {
            model: {
              equals: model.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),

      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom
                ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) }
                : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [detections, total] = await this.prisma.$transaction([
      this.prisma.detection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalFilename: true,
          model: true,
          processingTimeMs: true,
          imageWidth: true,
          imageHeight: true,
          totalDetections: true,
          createdAt: true,
        },
      }),
      this.prisma.detection.count({ where }),
    ]);

    return {
      success: true,
      data: detections.map((detection) => ({
        id: detection.id,
        filename: detection.originalFilename,
        model: detection.model,
        processingTimeMs: detection.processingTimeMs,
        imageWidth: detection.imageWidth,
        imageHeight: detection.imageHeight,
        totalDetections: detection.totalDetections,
        createdAt: detection.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const detection = await this.prisma.detection.findUnique({
      where: { id },
      select: {
        id: true,
        originalFilename: true,
        model: true,
        confidenceThreshold: true,
        processingTimeMs: true,
        imageWidth: true,
        imageHeight: true,
        totalDetections: true,
        createdAt: true,
        detections: {
          select: {
            id: true,
            classId: true,
            className: true,
            confidence: true,
            x1: true,
            y1: true,
            x2: true,
            y2: true,
          },
        },
      },
    });

    if (!detection) {
      throw new NotFoundException(`Detection with ID ${id} was not found`);
    }

    return {
      success: true,
      data: {
        id: detection.id,
        filename: detection.originalFilename,
        model: detection.model,
        confidenceThreshold: detection.confidenceThreshold,
        processingTimeMs: detection.processingTimeMs,
        imageWidth: detection.imageWidth,
        imageHeight: detection.imageHeight,
        totalDetections: detection.totalDetections,
        detections: detection.detections.map((item) => ({
          id: item.id,
          classId: item.classId,
          className: item.className,
          confidence: item.confidence,
          bbox: {
            x1: item.x1,
            y1: item.y1,
            x2: item.x2,
            y2: item.y2,
          },
        })),
        createdAt: detection.createdAt,
      },
    };
  }

  async detect(file: Express.Multer.File): Promise<InferenceResponse> {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const formData = new FormData();

    const imageBytes = new Uint8Array(file.buffer);
    const imageBuffer = imageBytes.buffer.slice(
      imageBytes.byteOffset,
      imageBytes.byteOffset + imageBytes.byteLength,
    );

    const imageBlob = new Blob([imageBuffer], {
      type: file.mimetype,
    });

    formData.append('file', imageBlob, file.originalname);

    const startedAt = performance.now();

    let response: Response;

    try {
      response = await fetch(`${this.inferenceUrl}/predict`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');

      await this.recordInferenceMetric({
        status: 'FAILED',
        requestDurationMs: performance.now() - startedAt,
        errorCode: isTimeout ? 'INFERENCE_TIMEOUT' : 'INFERENCE_UNAVAILABLE',
      });

      if (isTimeout) {
        throw new GatewayTimeoutException(
          'Inference service request timed out',
        );
      }

      throw new BadGatewayException(
        'Unable to communicate with inference service',
      );
    }

    if (!response.ok) {
      await this.recordInferenceMetric({
        status: 'FAILED',
        requestDurationMs: performance.now() - startedAt,
        httpStatus: response.status,
        errorCode: `INFERENCE_HTTP_${response.status}`,
      });

      switch (response.status) {
        case 400:
          throw new BadRequestException('Invalid image');
        case 413:
          throw new PayloadTooLargeException('Image exceeds allowed size');
        case 415:
          throw new UnsupportedMediaTypeException('Unsupported image format');
        case 503:
          throw new ServiceUnavailableException(
            'Inference model is unavailable',
          );
        default:
          throw new BadGatewayException(
            `Inference service failed with status ${response.status}`,
          );
      }
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      await this.recordInferenceMetric({
        status: 'FAILED',
        requestDurationMs: performance.now() - startedAt,
        httpStatus: response.status,
        errorCode: 'INVALID_INFERENCE_JSON',
      });

      throw new BadGatewayException(
        'Inference service returned an invalid response',
      );
    }

    if (!isValidInferenceResponse(data)) {
      await this.recordInferenceMetric({
        status: 'FAILED',
        requestDurationMs: performance.now() - startedAt,
        httpStatus: response.status,
        errorCode: 'INVALID_INFERENCE_RESPONSE',
      });

      throw new BadGatewayException(
        'Inference service returned an invalid response',
      );
    }

    await this.recordInferenceMetric({
      status: 'SUCCESS',
      modelName: data.model,
      processingTimeMs: data.processing_time_ms,
      requestDurationMs: performance.now() - startedAt,
      httpStatus: response.status,
    });

    // Keep detection persistence separate from inference monitoring.
    await this.persistDetection(file, data);

    return data;
  }

  async findImage(id: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    const detection = await this.prisma.detection.findUnique({
      where: { id },
      select: {
        storageKey: true,
        mimeType: true,
        originalFilename: true,
      },
    });

    if (!detection) {
      throw new NotFoundException(`Detection with ID ${id} was not found`);
    }

    const buffer = await this.storage.read(detection.storageKey);

    return {
      buffer,
      mimeType: detection.mimeType,
      filename: detection.originalFilename,
    };
  }
}
