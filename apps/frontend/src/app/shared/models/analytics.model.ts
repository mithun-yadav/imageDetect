export interface AnalyticsSummary {
  totalImages: number;
  totalObjects: number;
  averageProcessingTimeMs: number;
  averageObjectsPerImage: number;
}

export interface ClassDistribution {
  className: string;
  count: number;
}

export interface DailyActivity {
  date: string;
  totalImages: number;
  totalObjects: number;
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary;
  classDistribution: ClassDistribution[];
  activity: DailyActivity[];
}

export interface AnalyticsOverviewResponse {
  success: boolean;
  data: AnalyticsOverview;
}
