import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';

import { DetectionService } from './detection.service.js';
import type { InferenceResponse } from './detection.service.js';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@ApiTags('Detections')
@Controller('detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post()
  @ApiOperation({
    summary: 'Detect objects in an uploaded image',
    description:
      'Upload a JPEG, PNG, or WebP image (maximum 10 MB) for YOLO object detection.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, or WebP; maximum 10 MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        filename: { type: 'string', example: 'test-image.jpg' },
        model: { type: 'string', example: 'best.pt' },
        confidence_threshold: { type: 'number', example: 0.25 },
        processing_time_ms: { type: 'number', example: 42.5 },
        result: {
          type: 'object',
          properties: {
            image_width: { type: 'number', example: 640 },
            image_height: { type: 'number', example: 480 },
            total_detections: { type: 'number', example: 2 },
            detections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  class_id: { type: 'number', example: 0 },
                  class_name: { type: 'string', example: 'person' },
                  confidence: { type: 'number', example: 0.95 },
                  bbox: {
                    type: 'object',
                    properties: {
                      x1: { type: 'number', example: 100 },
                      y1: { type: 'number', example: 80 },
                      x2: { type: 'number', example: 250 },
                      y2: { type: 'number', example: 400 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing or invalid image file' })
  @ApiPayloadTooLargeResponse({ description: 'Image exceeds 10 MB' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported image format',
  })
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
