export type MonitoringStatus = 'healthy' | 'unavailable';

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

export interface MonitoringOverview {
  api: MonitoringApiStatus;
  database: MonitoringDatabaseStatus;
  inference: MonitoringInferenceStatus;
}

export interface MonitoringOverviewResponse {
  success: boolean;
  data: MonitoringOverview;
}
