export interface InferenceMonitoringResponse {
  status: string;
  model: {
    loaded: boolean;
    name: string;
    framework: string;
    frameworkVersion: string;
    device: string;
    confidenceThreshold: number;
    imageSize: number;
    classNames: string[];
  };
  metrics: {
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
  };
}
