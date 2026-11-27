import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service.js';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get analytics overview',
    description:
      'Retrieve image processing metrics, object distribution, and recent detection activity.',
  })
  @ApiOkResponse({
    description: 'Analytics overview retrieved successfully',
  })
  async getOverview() {
    const data = await this.analyticsService.getOverview();

    return {
      success: true,
      data,
    };
  }
}
