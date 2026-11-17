import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetectionService } from './detection.service.js';

describe('DetectionService', () => {
  let service: DetectionService;

  const mockFile = {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'test.png',
    mimetype: 'image/png',
    size: 15,
  } as Express.Multer.File;

  const mockInferenceResponse = {
    success: true,
    filename: 'test.png',
    model: 'best.pt',
    confidence_threshold: 0.25,
    processing_time_ms: 35.43,
    result: {
      image_width: 640,
      image_height: 480,
      total_detections: 1,
      detections: [
        {
          class_id: 0,
          class_name: 'person',
          confidence: 0.95,
          bbox: { x1: 10, y1: 20, x2: 100, y2: 200 },
        },
      ],
    },
  };

  beforeEach(() => {
    service = new DetectionService();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should return detections when inference succeeds', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockInferenceResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.detect(mockFile);

    expect(result).toEqual(mockInferenceResponse);
    expect(fetch).toHaveBeenCalledOnce();

    const [url, options] = vi.mocked(fetch).mock.calls[0];

    expect(url).toBe('http://127.0.0.1:8000/predict');
    expect(options?.method).toBe('POST');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('should reject an invalid inference response structure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            detections: 'invalid',
          },
        }),
        { status: 200 },
      ),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);
  });

  it('should reject detections with invalid bounding boxes', async () => {
    const invalidResponse = structuredClone(mockInferenceResponse);

    invalidResponse.result.detections[0].bbox.x2 = 99999;

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(invalidResponse), {
        status: 200,
      }),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);
  });

  it('should reject when detection count does not match the array length', async () => {
    const invalidResponse = structuredClone(mockInferenceResponse);

    invalidResponse.result.total_detections = 5;

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(invalidResponse), {
        status: 200,
      }),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);
  });

  it('should reject when the image file is missing', async () => {
    await expect(
      service.detect(undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should reject when the image buffer is empty', async () => {
    const emptyFile = {
      ...mockFile,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    await expect(service.detect(emptyFile)).rejects.toThrow(
      BadRequestException,
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw GatewayTimeoutException when inference times out', async () => {
    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';

    vi.mocked(fetch).mockRejectedValue(timeoutError);

    await expect(service.detect(mockFile)).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('should throw BadGatewayException when inference service is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);
  });

  it.each([
    [400, BadRequestException],
    [413, PayloadTooLargeException],
    [415, UnsupportedMediaTypeException],
    [503, ServiceUnavailableException],
    [500, BadGatewayException],
  ] as const)(
    'should map inference HTTP status %i correctly',
    async (status, expectedException) => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));

      await expect(service.detect(mockFile)).rejects.toThrow(expectedException);
    },
  );

  it('should reject when inference returns invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('invalid-json', {
        status: 200,
      }),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);
  });
});
