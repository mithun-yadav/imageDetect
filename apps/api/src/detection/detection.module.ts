import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module.js';

import { DetectionController } from './detection.controller.js';
import { DetectionService } from './detection.service.js';

@Module({
  imports: [StorageModule],
  controllers: [DetectionController],
  providers: [DetectionService],
})
export class DetectionModule {}
