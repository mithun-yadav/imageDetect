import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { MonitoringQueryDto } from './dto/monitoring-query.dto.js';
import { MonitoringService } from './monitoring.service.js';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get system and model monitoring overview',
    description:
      'Retrieve API, database, inference service, model and historical performance metrics.',
  })
  @ApiOkResponse({
    description: 'Monitoring overview retrieved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid monitoring time range',
  })
  async getOverview(@Query() query: MonitoringQueryDto) {
    const data = await this.monitoringService.getOverview(query);

    return {
      success: true,
      data,
    };
  }
}
