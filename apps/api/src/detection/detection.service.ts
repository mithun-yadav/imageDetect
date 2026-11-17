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
      return (await response.json()) as InferenceResponse;
    } catch {
      throw new BadGatewayException(
        'Inference service returned an invalid response',
      );
    }
  }
}
