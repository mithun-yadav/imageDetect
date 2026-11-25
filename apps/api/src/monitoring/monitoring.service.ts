import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { InferenceMonitoringResponse } from './interfaces/inference-monitoring.interface.js';

const INFERENCE_TIMEOUT_MS = 3000;

@Injectable()
export class MonitoringService {
  private readonly inferenceUrl =
    process.env.INFERENCE_BASE_URL ?? 'http://127.0.0.1:8000';

  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [database, inference] = await Promise.all([
      this.checkDatabase(),
      this.getInferenceMonitoring(),
    ]);

    return {
      api: {
        status: 'healthy',
        uptimeSeconds: Math.round(process.uptime()),
      },
      database,
      inference,
    };
  }

  private async checkDatabase() {
    const startTime = performance.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy' as const,
        responseTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    } catch {
      return {
        status: 'unavailable' as const,
        responseTimeMs: null,
      };
    }
  }

  private async getInferenceMonitoring() {
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.inferenceUrl}/monitoring`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          status: 'unavailable' as const,
          model: null,
          metrics: null,
        };
      }

      const data = (await response.json()) as InferenceMonitoringResponse;

      if (
        !data ||
        !data.model ||
        !data.metrics ||
        typeof data.model.loaded !== 'boolean'
      ) {
        return {
          status: 'unavailable' as const,
          model: null,
          metrics: null,
        };
      }

      return {
        status:
          data.status === 'ok' && data.model.loaded
            ? ('healthy' as const)
            : ('unavailable' as const),
        model: data.model,
        metrics: data.metrics,
      };
    } catch {
      return {
        status: 'unavailable' as const,
        model: null,
        metrics: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
