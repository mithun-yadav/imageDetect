export type MonitoringStatus = 'healthy' | 'unavailable';

export type MonitoringRange = '24h' | '7d' | '30d';

export interface MonitoringApiStatus {
  status: MonitoringStatus;
  uptimeSeconds: number;
}

export interface MonitoringDatabaseStatus {
  status: MonitoringStatus;
  responseTimeMs: number | null;
}

export interface MonitoringModel {
  loaded: boolean;
  name: string;
  framework: string;
  frameworkVersion: string;
  device: string;
  confidenceThreshold: number;
  imageSize: number;
  classNames: string[];
}

export interface InferenceMetrics {
  totalAttempts: number;
  successfulInferences: number;
  failedInferences: number;
  successRate: number | null;
  averageLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastInferenceAt: string | null;
  uptimeSeconds: number;
}

export interface MonitoringInferenceStatus {
  status: MonitoringStatus;
  model: MonitoringModel | null;
  metrics: InferenceMetrics | null;
}

export interface HistoricalMonitoringSummary {
  totalAttempts: number;
  successfulInferences: number;
  failedInferences: number;
  successRate: number;
  failureRate: number;
  averageProcessingTimeMs: number | null;
  averageRequestDurationMs: number | null;
  p95RequestDurationMs: number | null;
}

export interface InferenceTrend {
  timestamp: string;
  total: number;
  successful: number;
  failed: number;
  averageRequestDurationMs: number | null;
}

export interface ModelPerformance {
  modelName: string;
  totalAttempts: number;
  successfulInferences: number;
  failedInferences: number;
  successRate: number;
  averageRequestDurationMs: number | null;
}

export interface ErrorDistribution {
  errorCode: string;
  count: number;
}

export interface RecentInferenceActivity {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  modelName: string | null;
  processingTimeMs: number | null;
  requestDurationMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  createdAt: string;
}

export interface HistoricalMonitoring {
  available: boolean;
  range: MonitoringRange;
  startDate: string;
  endDate: string;
  summary: HistoricalMonitoringSummary | null;
  trends: InferenceTrend[];
  modelPerformance: ModelPerformance[];
  errorDistribution: ErrorDistribution[];
  recentActivity: RecentInferenceActivity[];
}

export interface MonitoringOverview {
  api: MonitoringApiStatus;
  database: MonitoringDatabaseStatus;
  inference: MonitoringInferenceStatus;
  historical: HistoricalMonitoring;
}

export interface MonitoringOverviewResponse {
  success: boolean;
  data: MonitoringOverview;
}
