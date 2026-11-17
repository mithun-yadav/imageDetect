import { Module } from '@nestjs/common';

import { DetectionController } from './detection.controller.js';
import { DetectionService } from './detection.service.js';

@Module({
  controllers: [DetectionController],
  providers: [DetectionService],
})
export class DetectionModule {}
