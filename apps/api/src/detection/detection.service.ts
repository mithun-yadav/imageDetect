import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

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

  async detect(file: Express.Multer.File): Promise<InferenceResponse> {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const formData = new FormData();

    // Copy the uploaded bytes into an ArrayBuffer for Node's Blob.
    const imageBytes = new Uint8Array(file.buffer);
    const imageBuffer = imageBytes.buffer.slice(
      imageBytes.byteOffset,
      imageBytes.byteOffset + imageBytes.byteLength,
    );

    const imageBlob = new Blob([imageBuffer], {
      type: file.mimetype,
    });

    formData.append('file', imageBlob, file.originalname);

    let response: Response;

    try {
      response = await fetch(`${this.inferenceUrl}/predict`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new GatewayTimeoutException(
          'Inference service request timed out',
        );
      }

      throw new BadGatewayException(
        'Unable to communicate with inference service',
      );
    }

    if (!response.ok) {
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

    try {
      const data: unknown = await response.json();

      if (!isValidInferenceResponse(data)) {
        throw new BadGatewayException(
          'Inference service returned an invalid response',
        );
      }

      return data;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        'Inference service returned an invalid response',
      );
    }
  }
}
