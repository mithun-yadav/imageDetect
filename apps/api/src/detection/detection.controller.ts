import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { DetectionService } from './detection.service.js';
import type { InferenceResponse } from './detection.service.js';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
      },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPEG, PNG and WebP images are supported',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async detect(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<InferenceResponse> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.detectionService.detect(file);
  }
}
