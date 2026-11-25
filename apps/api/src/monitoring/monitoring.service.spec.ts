import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service.js';
import { MonitoringService } from './monitoring.service.js';

describe('MonitoringService', () => {
  let service: MonitoringService;

  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
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

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

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

  it('should return complete monitoring overview', async () => {
    const result = await service.getOverview();

    expect(result.api.status).toBe('healthy');
    expect(result.api.uptimeSeconds).toBeGreaterThanOrEqual(0);

    expect(result.database.status).toBe('healthy');
    expect(result.database.responseTimeMs).toBeGreaterThanOrEqual(0);

    expect(result.inference).toEqual({
      status: 'healthy',
      model: inferenceResponse.model,
      metrics: inferenceResponse.metrics,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/monitoring',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('should return unavailable inference status when the service is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    const result = await service.getOverview();

    expect(result.inference).toEqual({
      status: 'unavailable',
      model: null,
      metrics: null,
    });

    expect(result.database.status).toBe('healthy');
  });

  it('should return unavailable inference status when HTTP response is unsuccessful', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));

    const result = await service.getOverview();

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model).toBeNull();
    expect(result.inference.metrics).toBeNull();
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

    const result = await service.getOverview();

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model).toBeNull();
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

    const result = await service.getOverview();

    expect(result.inference.status).toBe('unavailable');
    expect(result.inference.model?.loaded).toBe(false);
  });

  it('should return unavailable database status when database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

    const result = await service.getOverview();

    expect(result.database).toEqual({
      status: 'unavailable',
      responseTimeMs: null,
    });

    expect(result.inference.status).toBe('healthy');
    expect(result.api.status).toBe('healthy');
  });

  it('should return partial monitoring data when both dependencies are unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

    vi.mocked(fetch).mockRejectedValue(
      new TypeError('Inference service unavailable'),
    );

    const result = await service.getOverview();

    expect(result.api.status).toBe('healthy');
    expect(result.database.status).toBe('unavailable');
    expect(result.inference.status).toBe('unavailable');
  });

  it('should handle invalid JSON from inference service', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('invalid-json', {
        status: 200,
      }),
    );

    const result = await service.getOverview();

    expect(result.inference.status).toBe('unavailable');
  });
});
