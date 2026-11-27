import { MonitoringRange } from '../dto/monitoring-query.dto.js';

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
