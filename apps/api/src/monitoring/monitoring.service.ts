import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  MonitoringQueryDto,
  MonitoringRange,
} from './dto/monitoring-query.dto.js';
import { InferenceMonitoringResponse } from './interfaces/inference-monitoring.interface.js';
import {
  ErrorDistribution,
  HistoricalMonitoring,
  HistoricalMonitoringSummary,
  InferenceTrend,
  ModelPerformance,
  RecentInferenceActivity,
} from './interfaces/historical-monitoring.interface.js';

const INFERENCE_TIMEOUT_MS = 3000;
const RECENT_ACTIVITY_LIMIT = 20;

@Injectable()
export class MonitoringService {
  private readonly inferenceUrl =
    process.env.INFERENCE_BASE_URL ?? 'http://127.0.0.1:8000';

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: MonitoringQueryDto) {
    const [database, inference, historical] = await Promise.all([
      this.checkDatabase(),
      this.getInferenceMonitoring(),
      this.getHistoricalMonitoring(query.range),
    ]);

    return {
      api: {
        status: 'healthy',
        uptimeSeconds: Math.round(process.uptime()),
      },
      database,
      inference,
      historical,
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

  private getDateRange(range: MonitoringRange) {
    const endDate = new Date();
    const startDate = new Date(endDate);

    switch (range) {
      case '24h':
        startDate.setUTCHours(startDate.getUTCHours() - 24);
        break;

      case '7d':
        startDate.setUTCDate(startDate.getUTCDate() - 7);
        break;

      case '30d':
        startDate.setUTCDate(startDate.getUTCDate() - 30);
        break;
    }

    return { startDate, endDate };
  }

  private async getHistoricalMonitoring(
    range: MonitoringRange,
  ): Promise<HistoricalMonitoring> {
    const { startDate, endDate } = this.getDateRange(range);

    const unavailableResult: HistoricalMonitoring = {
      available: false,
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: null,
      trends: [],
      modelPerformance: [],
      errorDistribution: [],
      recentActivity: [],
    };

    try {
      const granularity = range === '24h' ? 'hour' : 'day';

      const [summaryRows, trendRows, modelRows, errorRows, recentRows] =
        await Promise.all([
          // 1. Historical summary
          this.prisma.$queryRaw<HistoricalMonitoringSummary[]>`
          SELECT
            COUNT(*)::int AS "totalAttempts",

            COUNT(*) FILTER (
              WHERE "status" = 'SUCCESS'
            )::int AS "successfulInferences",

            COUNT(*) FILTER (
              WHERE "status" = 'FAILED'
            )::int AS "failedInferences",

            AVG("processingTimeMs") AS "averageProcessingTimeMs",

            AVG("requestDurationMs") AS "averageRequestDurationMs",

            PERCENTILE_CONT(0.95) WITHIN GROUP (
              ORDER BY "requestDurationMs"
            ) AS "p95RequestDurationMs"

          FROM "InferenceMetric"

          WHERE "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
        `,

          // 2. Inference trends
          this.prisma.$queryRaw<
            {
              timestamp: Date;
              total: number;
              successful: number;
              failed: number;
              averageRequestDurationMs: number | null;
            }[]
          >`
          SELECT
            DATE_TRUNC(${granularity}, "createdAt") AS "timestamp",

            COUNT(*)::int AS "total",

            COUNT(*) FILTER (
              WHERE "status" = 'SUCCESS'
            )::int AS "successful",

            COUNT(*) FILTER (
              WHERE "status" = 'FAILED'
            )::int AS "failed",

            AVG("requestDurationMs") AS "averageRequestDurationMs"

          FROM "InferenceMetric"

          WHERE "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}

          GROUP BY DATE_TRUNC(${granularity}, "createdAt")

          ORDER BY "timestamp" ASC
        `,

          // 3. Model-wise performance
          this.prisma.$queryRaw<
            {
              modelName: string;
              totalAttempts: number;
              successfulInferences: number;
              failedInferences: number;
              averageRequestDurationMs: number | null;
            }[]
          >`
          SELECT
            COALESCE("modelName", 'Unknown model') AS "modelName",

            COUNT(*)::int AS "totalAttempts",

            COUNT(*) FILTER (
              WHERE "status" = 'SUCCESS'
            )::int AS "successfulInferences",

            COUNT(*) FILTER (
              WHERE "status" = 'FAILED'
            )::int AS "failedInferences",

            AVG("requestDurationMs") AS "averageRequestDurationMs"

          FROM "InferenceMetric"

          WHERE "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}

          GROUP BY "modelName"

          ORDER BY "totalAttempts" DESC
        `,

          // 4. Error distribution
          this.prisma.$queryRaw<
            {
              errorCode: string;
              count: number;
            }[]
          >`
          SELECT
            COALESCE("errorCode", 'UNKNOWN') AS "errorCode",
            COUNT(*)::int AS "count"

          FROM "InferenceMetric"

          WHERE "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
            AND "status" = 'FAILED'

          GROUP BY "errorCode"

          ORDER BY "count" DESC
        `,

          // 5. Recent inference activity
          this.prisma.inferenceMetric.findMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: RECENT_ACTIVITY_LIMIT,
            select: {
              id: true,
              status: true,
              modelName: true,
              processingTimeMs: true,
              requestDurationMs: true,
              httpStatus: true,
              errorCode: true,
              createdAt: true,
            },
          }),
        ]);

      const rows = summaryRows[0];

      if (!rows) {
        throw new Error('Historical summary query returned no result');
      }

      const total = Number(rows.totalAttempts);
      const successful = Number(rows.successfulInferences);
      const failed = Number(rows.failedInferences);

      const summary: HistoricalMonitoringSummary = {
        totalAttempts: total,
        successfulInferences: successful,
        failedInferences: failed,

        successRate:
          total > 0 ? Number(((successful / total) * 100).toFixed(2)) : 0,

        failureRate:
          total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0,

        averageProcessingTimeMs:
          rows.averageProcessingTimeMs === null
            ? null
            : Number(rows.averageProcessingTimeMs),

        averageRequestDurationMs:
          rows.averageRequestDurationMs === null
            ? null
            : Number(rows.averageRequestDurationMs),

        p95RequestDurationMs:
          rows.p95RequestDurationMs === null
            ? null
            : Number(rows.p95RequestDurationMs),
      };

      const trends: InferenceTrend[] = trendRows.map((row) => ({
        timestamp: new Date(row.timestamp).toISOString(),
        total: Number(row.total),
        successful: Number(row.successful),
        failed: Number(row.failed),
        averageRequestDurationMs:
          row.averageRequestDurationMs === null
            ? null
            : Number(row.averageRequestDurationMs),
      }));

      const modelPerformance: ModelPerformance[] = modelRows.map((row) => {
        const modelTotal = Number(row.totalAttempts);
        const modelSuccessful = Number(row.successfulInferences);
        const modelFailed = Number(row.failedInferences);

        return {
          modelName: row.modelName,
          totalAttempts: modelTotal,
          successfulInferences: modelSuccessful,
          failedInferences: modelFailed,
          successRate:
            modelTotal > 0
              ? Number(((modelSuccessful / modelTotal) * 100).toFixed(2))
              : 0,
          averageRequestDurationMs:
            row.averageRequestDurationMs === null
              ? null
              : Number(row.averageRequestDurationMs),
        };
      });

      const errorDistribution: ErrorDistribution[] = errorRows.map((row) => ({
        errorCode: row.errorCode,
        count: Number(row.count),
      }));

      const recentActivity: RecentInferenceActivity[] = recentRows.map(
        (row) => ({
          ...row,
          requestDurationMs: Number(row.requestDurationMs),
          processingTimeMs:
            row.processingTimeMs === null ? null : Number(row.processingTimeMs),
          createdAt: row.createdAt.toISOString(),
        }),
      );

      return {
        available: true,
        range,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary,
        trends,
        modelPerformance,
        errorDistribution,
        recentActivity,
      };
    } catch {
      return unavailableResult;
    }
  }
}
