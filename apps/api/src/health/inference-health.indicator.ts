import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

interface InferenceHealthResponse {
  status: string;
  model_loaded: boolean;
  device: string;
}

@Injectable()
export class InferenceHealthIndicator {
  private readonly inferenceUrl =
    process.env.INFERENCE_BASE_URL ?? 'http://127.0.0.1:8000';

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy() {
    return this.healthIndicatorService
      .check('inference')
      .attempt(async ({ signal }) => {
        const response = await fetch(`${this.inferenceUrl}/health`, { signal });

        if (!response.ok) {
          throw new Error(`Inference service returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as InferenceHealthResponse;

        if (data.status !== 'ok' || data.model_loaded !== true) {
          throw new Error('Inference model is not ready');
        }

        return data;
      })
      .withSuccessData((data) => ({
        modelLoaded: data.model_loaded,
        device: data.device,
      }))
      .withTimeout(2000);
  }
}
