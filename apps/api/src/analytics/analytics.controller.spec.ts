import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  let analyticsService: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    analyticsService = {
      getOverview: vi.fn(),
    };

    controller = new AnalyticsController(
      analyticsService as unknown as AnalyticsService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return analytics overview successfully', async () => {
    const overview = {
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
    };

    analyticsService.getOverview.mockResolvedValue(overview);

    const result = await controller.getOverview();

    expect(result).toEqual({
      success: true,
      data: overview,
    });

    expect(analyticsService.getOverview).toHaveBeenCalledOnce();
  });

  it('should propagate analytics service errors', async () => {
    analyticsService.getOverview.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(controller.getOverview()).rejects.toThrow(
      'Database connection failed',
    );
  });
});
