import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InferenceHealthIndicator } from './inference-health.indicator.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly inferenceHealth: InferenceHealthIndicator,
  ) {}

  @Get('live')
  @ApiOperation({
    summary: 'Check whether the API is running',
  })
  @ApiResponse({
    status: 200,
    description: 'API process is alive',
    schema: {
      example: {
        status: 'ok',
        service: 'api',
      },
    },
  })
  live() {
    return {
      status: 'ok',
      service: 'api',
    };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check API and inference service readiness',
  })
  @ApiResponse({
    status: 200,
    description: 'API and inference service are healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Inference service is unavailable or unhealthy',
  })
  ready() {
    return this.health.check([() => this.inferenceHealth.isHealthy()]);
  }
}
