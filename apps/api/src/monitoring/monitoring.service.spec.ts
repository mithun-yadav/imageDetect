import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service.js';
import { MonitoringQueryDto } from './dto/monitoring-query.dto.js';
import { MonitoringService } from './monitoring.service.js';

describe('MonitoringService', () => {
  let service: MonitoringService;

  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    inferenceMetric: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const inferenceResponse = {
    status: 'ok',
    model: {
      loaded: true,
      name: 'best.pt',
      framework: 'Ultralytics YOLO',
      frameworkVersion: '8.4.203',
      device: 'cpu',
      confidenceThreshold: 0.25,
      imageSize: 640,
      classNames: ['person', 'bicycle', 'car', 'dog'],
    },
    metrics: {
      totalAttempts: 2,
      successfulInferences: 1,
      failedInferences: 1,
      successRate: 50,
      averageLatencyMs: 865.07,
      minLatencyMs: 0,
      maxLatencyMs: 1730.14,
      lastLatencyMs: 0,
      lastInferenceAt: '2026-11-25T10:50:16.547434+00:00',
      uptimeSeconds: 120,
    },
  };

  const historicalRow = {
    totalAttempts: 10,
    successfulInferences: 8,
    failedInferences: 2,
    averageProcessingTimeMs: 850.5,
    averageRequestDurationMs: 1100.75,
    p95RequestDurationMs: 1800.25,
  };

  const query: MonitoringQueryDto = {
    range: '24h',
  };

  type HistoricalSummaryMock = {
    totalAttempts: number;
    successfulInferences: number;
    failedInferences: number;
    averageProcessingTimeMs: number | null;
    averageRequestDurationMs: number | null;
    p95RequestDurationMs: number | null;
  };

  const mockHealthyDatabaseAndHistory = (
    summary: HistoricalSummaryMock = historicalRow,
  ) => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([summary])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    prisma.inferenceMetric.findMany.mockResolvedValue([]);
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      inferenceMetric: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockHealthyDatabaseAndHistory();

    service = new MonitoringService(prisma as unknown as PrismaService);

    vi.stubGlobal('fetch', vi.fn());

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(inferenceResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return complete monitoring overview with historical metrics', async () => {
    const result = await service.getOverview(query);

    expect(result.api.status).toBe('healthy');
    expect(result.api.uptimeSeconds).toBeGreaterThanOrEqual(0);

    expect(result.database.status).toBe('healthy');
    expect(result.database.responseTimeMs).toBeGreaterThanOrEqual(0);

    expect(result.inference).toEqual({
      status: 'healthy',
      model: inferenceResponse.model,
      metrics: inferenceResponse.metrics,
    });

    expect(result.historical.available).toBe(true);
    expect(result.historical.range).toBe('24h');

    expect(result.historical.summary).toEqual({
      totalAttempts: 10,
      successfulInferences: 8,
      failedInferences: 2,
      successRate: 80,
      failureRate: 20,
      averageProcessingTimeMs: 850.5,
      averageRequestDurationMs: 1100.75,
      p95RequestDurationMs: 1800.25,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(prisma.inferenceMetric.findMany).toHaveBeenCalledTimes(1);

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/monitoring',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('should return zero counts and null latency when no historical records exist', async () => {
    prisma.$queryRaw.mockReset();

    mockHealthyDatabaseAndHistory({
      totalAttempts: 0,
      successfulInferences: 0,
      failedInferences: 0,
      averageProcessingTimeMs: null,
      averageRequestDurationMs: null,
      p95RequestDurationMs: null,
    });

    const result = await service.getOverview(query);

    expect(result.historical.available).toBe(true);

    expect(result.historical.summary).toEqual({
      totalAttempts: 0,
      successfulInferences: 0,
      failedInferences: 0,
      successRate: 0,
      failureRate: 0,
      averageProcessingTimeMs: null,
      averageRequestDurationMs: null,
      p95RequestDurationMs: null,
    });
  });

  it('should keep live monitoring available when historical query fails', async () => {
    prisma.$queryRaw.mockReset();

    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockRejectedValueOnce(new Error('Historical query failed'));

    const result = await service.getOverview(query);

    expect(result.database.status).toBe('healthy');
    expect(result.inference.status).toBe('healthy');

    expect(result.historical.available).toBe(false);
    expect(result.historical.summary).toBeNull();
  });

  it('should return unavailable inference status when the service is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    const result = await service.getOverview(query);

    expect(result.inference).toEqual({
      status: 'unavailable',
      model: null,
      metrics: null,
    });

    expect(result.database.status).toBe('healthy');
    expect(result.historical.available).toBe(true);
  });

  it('should return unavailable inference status when HTTP response is unsuccessful', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));

    const result = await service.getOverview(query);

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model).toBeNull();
    expect(result.inference.metrics).toBeNull();
    expect(result.historical.available).toBe(true);
  });

  it('should handle invalid inference response structure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          model: null,
          metrics: null,
        }),
        { status: 200 },
      ),
    );

    const result = await service.getOverview(query);

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model).toBeNull();
    expect(result.historical.available).toBe(true);
  });

  it('should report inference unavailable when the model is not loaded', async () => {
    const unavailableResponse = {
      ...inferenceResponse,
      status: 'unavailable',
      model: {
        ...inferenceResponse.model,
        loaded: false,
      },
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(unavailableResponse), {
        status: 200,
      }),
    );

    const result = await service.getOverview(query);

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model?.loaded).toBe(false);
    expect(result.historical.available).toBe(true);
  });

  it('should return unavailable database status when database health query fails', async () => {
    prisma.$queryRaw.mockReset();

    prisma.$queryRaw
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValueOnce([historicalRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    prisma.inferenceMetric.findMany.mockResolvedValue([]);

    const result = await service.getOverview(query);

    expect(result.database.status).toBe('unavailable');
    expect(result.database.responseTimeMs).toBeNull();

    expect(result.inference.status).toBe('healthy');
    expect(result.api.status).toBe('healthy');

    expect(result.historical.available).toBe(true);
  });

  it('should return partial monitoring data when database and inference are unavailable', async () => {
    prisma.$queryRaw.mockReset();

    prisma.$queryRaw
      .mockRejectedValueOnce(new Error('Database health check failed'))
      .mockRejectedValueOnce(new Error('Historical query failed'));

    vi.mocked(fetch).mockRejectedValue(
      new TypeError('Inference service unavailable'),
    );

    const result = await service.getOverview(query);

    expect(result.api.status).toBe('healthy');
    expect(result.database.status).toBe('unavailable');
    expect(result.inference.status).toBe('unavailable');
    expect(result.historical.available).toBe(false);
  });

  it('should handle invalid JSON from inference service', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('invalid-json', {
        status: 200,
      }),
    );

    const result = await service.getOverview(query);

    expect(result.inference.status).toBe('unavailable');
    expect(result.historical.available).toBe(true);
  });

  it('should support the seven-day historical range', async () => {
    const result = await service.getOverview({
      range: '7d',
    });

    expect(result.historical.range).toBe('7d');

    const duration =
      new Date(result.historical.endDate).getTime() -
      new Date(result.historical.startDate).getTime();

    expect(duration).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('should support the thirty-day historical range', async () => {
    const result = await service.getOverview({
      range: '30d',
    });

    expect(result.historical.range).toBe('30d');

    const duration =
      new Date(result.historical.endDate).getTime() -
      new Date(result.historical.startDate).getTime();

    expect(duration).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
