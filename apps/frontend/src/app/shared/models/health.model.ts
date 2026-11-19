export interface InferenceHealth {
  modelLoaded: boolean;
  device: string;
  responseTime: number;
  status: 'up' | 'down';
}

export interface HealthResponse {
  status: string;
  info: {
    inference: InferenceHealth;
  };
  error: Record<string, unknown>;
  details: {
    inference: InferenceHealth;
  };
}
