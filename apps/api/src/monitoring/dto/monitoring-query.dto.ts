import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const MONITORING_RANGES = ['24h', '7d', '30d'] as const;

export type MonitoringRange = (typeof MONITORING_RANGES)[number];

export class MonitoringQueryDto {
  @ApiPropertyOptional({
    description: 'Historical monitoring time range',
    example: '24h',
    enum: MONITORING_RANGES,
    default: '24h',
  })
  @IsOptional()
  @IsIn(MONITORING_RANGES)
  range: MonitoringRange = '24h';
}
