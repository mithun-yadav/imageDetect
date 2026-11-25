import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonitoringService } from './monitoring.service.js';
import { MonitoringController } from './monitoring.controller.js';

describe('MonitoringController', () => {
  let controller: MonitoringController;

  let monitoringService: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    monitoringService = {
      getOverview: vi.fn(),
    };

    controller = new MonitoringController(
      monitoringService as unknown as MonitoringService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return monitoring overview successfully', async () => {
    const overview = {
      api: {
        status: 'healthy',
        uptimeSeconds: 3600,
      },
      database: {
        status: 'healthy',
        responseTimeMs: 2.5,
      },
      inference: {
        status: 'healthy',
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
      },
    };

    monitoringService.getOverview.mockResolvedValue(overview);

    const result = await controller.getOverview();

    expect(result).toEqual({
      success: true,
      data: overview,
    });

    expect(monitoringService.getOverview).toHaveBeenCalledOnce();
  });

  it('should return partial monitoring data when a dependency is unavailable', async () => {
    const partialOverview = {
      api: {
        status: 'healthy',
        uptimeSeconds: 3600,
      },
      database: {
        status: 'healthy',
        responseTimeMs: 2.5,
      },
      inference: {
        status: 'unavailable',
        model: null,
        metrics: null,
      },
    };

    monitoringService.getOverview.mockResolvedValue(partialOverview);

    const result = await controller.getOverview();

    expect(result).toEqual({
      success: true,
      data: partialOverview,
    });
  });

  it('should propagate unexpected monitoring service errors', async () => {
    monitoringService.getOverview.mockRejectedValue(
      new Error('Unexpected monitoring error'),
    );

    await expect(controller.getOverview()).rejects.toThrow(
      'Unexpected monitoring error',
    );
  });
});
