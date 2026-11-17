import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { InferenceHealthIndicator } from './inference-health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly inferenceHealth: InferenceHealthIndicator,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'api',
    };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.inferenceHealth.isHealthy()]);
  }
}
