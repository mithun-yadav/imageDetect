import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

import { DetectionService } from './detection.service.js';

describe('DetectionService', () => {
  let service: DetectionService;

  let prisma: {
    detection: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  let storage: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

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
    prisma = {
      detection: {
        create: vi.fn().mockResolvedValue({ id: 'detection-id' }),
      },
    };

    storage = {
      save: vi
        .fn()
        .mockResolvedValue('550e8400-e29b-41d4-a716-446655440000.png'),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    service = new DetectionService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );

    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should persist an image when inference returns zero detections', async () => {
    const zeroDetectionResponse = structuredClone(mockInferenceResponse);

    zeroDetectionResponse.result.total_detections = 0;
    zeroDetectionResponse.result.detections = [];

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(zeroDetectionResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.detect(mockFile);

    expect(result).toEqual(zeroDetectionResponse);

    expect(storage.save).toHaveBeenCalledOnce();

    expect(prisma.detection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalDetections: 0,
        detections: {
          create: [],
        },
      }),
    });

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('should clean up the stored image when database persistence fails', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockInferenceResponse), {
        status: 200,
      }),
    );

    prisma.detection.create.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(storage.save).toHaveBeenCalledOnce();

    expect(storage.delete).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000.png',
    );
  });

  it('should not save an image when inference fails', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new TypeError('Inference service unavailable'),
    );

    await expect(service.detect(mockFile)).rejects.toThrow(BadGatewayException);

    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.detection.create).not.toHaveBeenCalled();
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

  it('should persist a detection when no objects are detected', async () => {
    const emptyInferenceResponse = structuredClone(mockInferenceResponse);

    emptyInferenceResponse.result.total_detections = 0;
    emptyInferenceResponse.result.detections = [];

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(emptyInferenceResponse), {
        status: 200,
      }),
    );

    const result = await service.detect(mockFile);

    expect(result).toEqual(emptyInferenceResponse);

    expect(prisma.detection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalDetections: 0,
        detections: {
          create: [],
        },
      }),
    });
  });

  it('should still return an internal server error when image cleanup fails', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockInferenceResponse), {
        status: 200,
      }),
    );

    prisma.detection.create.mockRejectedValue(
      new Error('Database connection failed'),
    );

    storage.delete.mockRejectedValue(new Error('Filesystem unavailable'));

    await expect(service.detect(mockFile)).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(storage.delete).toHaveBeenCalledOnce();
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
