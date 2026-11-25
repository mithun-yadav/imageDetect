import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MonitoringService } from './monitoring.service.js';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get system and model monitoring overview',
    description:
      'Retrieve API, database, inference service, model and performance metrics.',
  })
  @ApiOkResponse({
    description: 'Monitoring overview retrieved successfully',
  })
  async getOverview() {
    const data = await this.monitoringService.getOverview();

    return {
      success: true,
      data,
    };
  }
}
