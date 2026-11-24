import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { GetDetectionsQueryDto } from './dto/get-detections-query.dto.js';

import { DetectionService } from './detection.service.js';

describe('DetectionService', () => {
  let service: DetectionService;
  let prisma: {
    detection: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
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
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
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

  describe('findAll', () => {
    it('should return paginated detection history', async () => {
      const createdAt = new Date('2026-11-20T10:08:23.454Z');

      const mockDetections = [
        {
          id: 'detection-id-1',
          originalFilename: 'train-image-9.jpg',
          model: 'best.pt',
          processingTimeMs: 2125.5,
          imageWidth: 612,
          imageHeight: 241,
          totalDetections: 5,
          createdAt,
        },
      ];

      prisma.detection.findMany.mockResolvedValue(mockDetections);
      prisma.detection.count.mockResolvedValue(21);

      const query = {
        page: 2,
        limit: 10,
      } as GetDetectionsQueryDto;

      const result = await service.findAll(query);

      expect(prisma.detection.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 10,
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
      });

      expect(prisma.detection.count).toHaveBeenCalledWith({
        where: {},
      });

      expect(prisma.$transaction).toHaveBeenCalledOnce();

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: 'detection-id-1',
            filename: 'train-image-9.jpg',
            model: 'best.pt',
            processingTimeMs: 2125.5,
            imageWidth: 612,
            imageHeight: 241,
            totalDetections: 5,
            createdAt,
          },
        ],
        meta: {
          page: 2,
          limit: 10,
          total: 21,
          totalPages: 3,
        },
      });
    });

    it('should return empty results when no detections exist', async () => {
      prisma.detection.findMany.mockResolvedValue([]);
      prisma.detection.count.mockResolvedValue(0);

      const result = await service.findAll({
        page: 1,
        limit: 10,
      } as GetDetectionsQueryDto);

      expect(result).toEqual({
        success: true,
        data: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it('should calculate the correct offset for later pages', async () => {
      await service.findAll({
        page: 5,
        limit: 20,
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 80,
          take: 20,
        }),
      );
    });

    it('should propagate database errors', async () => {
      prisma.$transaction.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.findAll({
          page: 1,
          limit: 10,
        } as GetDetectionsQueryDto),
      ).rejects.toThrow('Database connection failed');
    });

    it('should filter by filename using case-insensitive partial matching', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        search: '  train-image  ',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            originalFilename: {
              contains: 'train-image',
              mode: 'insensitive',
            },
          },
        }),
      );
    });

    it('should filter by detected class name', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        className: 'person',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            detections: {
              some: {
                className: {
                  equals: 'person',
                  mode: 'insensitive',
                },
              },
            },
          },
        }),
      );
    });

    it('should filter by model name', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        model: 'best.pt',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            model: {
              equals: 'best.pt',
              mode: 'insensitive',
            },
          },
        }),
      );
    });

    it('should filter by an inclusive UTC date range', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        dateFrom: '2026-11-01',
        dateTo: '2026-11-20',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lte: new Date('2026-11-20T23:59:59.999Z'),
            },
          },
        }),
      );
    });

    it('should combine all supplied filters using AND conditions', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        search: 'train',
        className: 'person',
        model: 'best.pt',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-20',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            originalFilename: {
              contains: 'train',
              mode: 'insensitive',
            },
            detections: {
              some: {
                className: {
                  equals: 'person',
                  mode: 'insensitive',
                },
              },
            },
            model: {
              equals: 'best.pt',
              mode: 'insensitive',
            },
            createdAt: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lte: new Date('2026-11-20T23:59:59.999Z'),
            },
          },
        }),
      );
    });

    it('should use the same filters for findMany and count', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        search: 'train',
        model: 'best.pt',
      } as GetDetectionsQueryDto);

      const findManyWhere = prisma.detection.findMany.mock.calls[0][0]?.where;

      const countWhere = prisma.detection.count.mock.calls[0][0]?.where;

      expect(findManyWhere).toEqual(countWhere);
    });

    it('should ignore empty or whitespace-only search filters', async () => {
      await service.findAll({
        page: 1,
        limit: 10,
        search: '   ',
        className: '   ',
        model: '   ',
      } as GetDetectionsQueryDto);

      expect(prisma.detection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should reject an invalid date range', async () => {
      await expect(
        service.findAll({
          page: 1,
          limit: 10,
          dateFrom: '2026-11-20',
          dateTo: '2026-11-01',
        } as GetDetectionsQueryDto),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.detection.findMany).not.toHaveBeenCalled();
      expect(prisma.detection.count).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const detectionId = '73005360-02a3-4f2c-8557-f766e87f2e5f';

    it('should return complete detection details with bounding boxes', async () => {
      const createdAt = new Date('2026-11-20T10:08:23.454Z');

      prisma.detection.findUnique.mockResolvedValue({
        id: detectionId,
        originalFilename: 'train-image-9.jpg',
        model: 'best.pt',
        confidenceThreshold: 0.25,
        processingTimeMs: 2125.5,
        imageWidth: 612,
        imageHeight: 241,
        totalDetections: 1,
        createdAt,
        detections: [
          {
            id: 'item-id-1',
            classId: 2,
            className: 'car',
            confidence: 0.84,
            x1: 139.22,
            y1: 118.65,
            x2: 262.42,
            y2: 188.71,
          },
        ],
      });

      const result = await service.findOne(detectionId);

      expect(prisma.detection.findUnique).toHaveBeenCalledWith({
        where: { id: detectionId },
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

      expect(result).toEqual({
        success: true,
        data: {
          id: detectionId,
          filename: 'train-image-9.jpg',
          model: 'best.pt',
          confidenceThreshold: 0.25,
          processingTimeMs: 2125.5,
          imageWidth: 612,
          imageHeight: 241,
          totalDetections: 1,
          detections: [
            {
              id: 'item-id-1',
              classId: 2,
              className: 'car',
              confidence: 0.84,
              bbox: {
                x1: 139.22,
                y1: 118.65,
                x2: 262.42,
                y2: 188.71,
              },
            },
          ],
          createdAt,
        },
      });

      expect(result.data).not.toHaveProperty('storageKey');
    });

    it('should return detection details with an empty detections array', async () => {
      prisma.detection.findUnique.mockResolvedValue({
        id: detectionId,
        originalFilename: 'empty-image.jpg',
        model: 'best.pt',
        confidenceThreshold: 0.25,
        processingTimeMs: 100,
        imageWidth: 640,
        imageHeight: 480,
        totalDetections: 0,
        createdAt: new Date('2026-11-20T10:08:23.454Z'),
        detections: [],
      });

      const result = await service.findOne(detectionId);

      expect(result.data.detections).toEqual([]);
      expect(result.data.totalDetections).toBe(0);
    });

    it('should throw NotFoundException when detection does not exist', async () => {
      prisma.detection.findUnique.mockResolvedValue(null);

      await expect(service.findOne(detectionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate database errors', async () => {
      prisma.detection.findUnique.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.findOne(detectionId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
