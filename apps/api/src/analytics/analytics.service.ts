import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

interface DailyActivityRow {
  date: Date;
  totalImages: bigint;
  totalObjects: bigint;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [totalImages, aggregate, classDistribution, dailyActivity] =
      await Promise.all([
        this.prisma.detection.count(),

        this.prisma.detection.aggregate({
          _sum: {
            totalDetections: true,
          },
          _avg: {
            processingTimeMs: true,
          },
        }),

        this.prisma.detectionItem.groupBy({
          by: ['className'],
          _count: {
            className: true,
          },
          orderBy: {
            _count: {
              className: 'desc',
            },
          },
        }),

        this.prisma.$queryRaw<DailyActivityRow[]>`
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS date
  ),
  daily_stats AS (
    SELECT
      DATE("createdAt") AS date,
      COUNT(*) AS "totalImages",
      COALESCE(SUM("totalDetections"), 0) AS "totalObjects"
    FROM "Detection"
    WHERE "createdAt" >= CURRENT_DATE - INTERVAL '6 days'
      AND "createdAt" < CURRENT_DATE + INTERVAL '1 day'
    GROUP BY DATE("createdAt")
  )
  SELECT
    date_series.date AS date,
    COALESCE(daily_stats."totalImages", 0)::bigint AS "totalImages",
    COALESCE(daily_stats."totalObjects", 0)::bigint AS "totalObjects"
  FROM date_series
  LEFT JOIN daily_stats
    ON date_series.date = daily_stats.date
  ORDER BY date_series.date ASC
`,
      ]);

    const totalObjects = aggregate._sum.totalDetections ?? 0;

    const averageProcessingTimeMs = aggregate._avg.processingTimeMs ?? 0;

    const averageObjectsPerImage =
      totalImages > 0 ? totalObjects / totalImages : 0;

    return {
      summary: {
        totalImages,
        totalObjects,
        averageProcessingTimeMs: Number(averageProcessingTimeMs.toFixed(2)),
        averageObjectsPerImage: Number(averageObjectsPerImage.toFixed(2)),
      },

      classDistribution: classDistribution.map((item) => ({
        className: item.className,
        count: item._count.className,
      })),

      activity: dailyActivity.map((item) => ({
        date: item.date.toISOString().slice(0, 10),
        totalImages: Number(item.totalImages),
        totalObjects: Number(item.totalObjects),
      })),
    };
  }
}
