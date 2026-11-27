import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { MonitoringModule } from './monitoring/monitoring.module.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { DetectionModule } from './detection/detection.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { DatabaseModule } from './database/database.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
    HealthModule,
    DetectionModule,
    AnalyticsModule,
    MonitoringModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
