import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service.js';

import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  let prisma: {
    detection: {
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    detectionItem: {
      groupBy: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      detection: {
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      detectionItem: {
        groupBy: vi.fn(),
      },
      $queryRaw: vi.fn(),
    };

    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return aggregated analytics overview', async () => {
    prisma.detection.count.mockResolvedValue(10);

    prisma.detection.aggregate.mockResolvedValue({
      _sum: {
        totalDetections: 50,
      },
      _avg: {
        processingTimeMs: 125.456,
      },
    });

    prisma.detectionItem.groupBy.mockResolvedValue([
      {
        className: 'person',
        _count: {
          className: 30,
        },
      },
      {
        className: 'car',
        _count: {
          className: 20,
        },
      },
    ]);

    prisma.$queryRaw.mockResolvedValue([
      {
        date: new Date('2026-11-24T00:00:00.000Z'),
        totalImages: 5n,
        totalObjects: 25n,
      },
    ]);

    const result = await service.getOverview();

    expect(result).toEqual({
      summary: {
        totalImages: 10,
        totalObjects: 50,
        averageProcessingTimeMs: 125.46,
        averageObjectsPerImage: 5,
      },
      classDistribution: [
        {
          className: 'person',
          count: 30,
        },
        {
          className: 'car',
          count: 20,
        },
      ],
      activity: [
        {
          date: '2026-11-24',
          totalImages: 5,
          totalObjects: 25,
        },
      ],
    });
  });

  it('should return zero values when there are no detections', async () => {
    prisma.detection.count.mockResolvedValue(0);

    prisma.detection.aggregate.mockResolvedValue({
      _sum: {
        totalDetections: null,
      },
      _avg: {
        processingTimeMs: null,
      },
    });

    prisma.detectionItem.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getOverview();

    expect(result).toEqual({
      summary: {
        totalImages: 0,
        totalObjects: 0,
        averageProcessingTimeMs: 0,
        averageObjectsPerImage: 0,
      },
      classDistribution: [],
      activity: [],
    });
  });

  it('should convert PostgreSQL BigInt values into numbers', async () => {
    prisma.detection.count.mockResolvedValue(2);

    prisma.detection.aggregate.mockResolvedValue({
      _sum: {
        totalDetections: 8,
      },
      _avg: {
        processingTimeMs: 100,
      },
    });

    prisma.detectionItem.groupBy.mockResolvedValue([
      {
        className: 'person',
        _count: {
          className: 8,
        },
      },
    ]);

    prisma.$queryRaw.mockResolvedValue([
      {
        date: new Date('2026-11-24T00:00:00.000Z'),
        totalImages: 2n,
        totalObjects: 8n,
      },
    ]);

    const result = await service.getOverview();

    expect(result.activity[0]).toEqual({
      date: '2026-11-24',
      totalImages: 2,
      totalObjects: 8,
    });

    expect(typeof result.activity[0].totalImages).toBe('number');
    expect(typeof result.activity[0].totalObjects).toBe('number');
  });

  it('should propagate database errors', async () => {
    prisma.detection.count.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(service.getOverview()).rejects.toThrow(
      'Database connection failed',
    );
  });

  it('should include dates with zero activity', async () => {
    prisma.detection.count.mockResolvedValue(1);

    prisma.detection.aggregate.mockResolvedValue({
      _sum: {
        totalDetections: 2,
      },
      _avg: {
        processingTimeMs: 100,
      },
    });

    prisma.detectionItem.groupBy.mockResolvedValue([
      {
        className: 'person',
        _count: {
          className: 2,
        },
      },
    ]);

    prisma.$queryRaw.mockResolvedValue([
      {
        date: new Date('2026-11-18T00:00:00.000Z'),
        totalImages: 0n,
        totalObjects: 0n,
      },
      {
        date: new Date('2026-11-19T00:00:00.000Z'),
        totalImages: 0n,
        totalObjects: 0n,
      },
      {
        date: new Date('2026-11-20T00:00:00.000Z'),
        totalImages: 1n,
        totalObjects: 2n,
      },
    ]);

    const result = await service.getOverview();

    expect(result.activity).toEqual([
      {
        date: '2026-11-18',
        totalImages: 0,
        totalObjects: 0,
      },
      {
        date: '2026-11-19',
        totalImages: 0,
        totalObjects: 0,
      },
      {
        date: '2026-11-20',
        totalImages: 1,
        totalObjects: 2,
      },
    ]);
  });
});
