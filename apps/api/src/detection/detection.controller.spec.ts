import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetectionController } from './detection.controller.js';
import { DetectionService } from './detection.service.js';
import type { InferenceResponse } from './detection.service.js';

describe('DetectionController', () => {
  let controller: DetectionController;

  const mockFile = {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'test.png',
    mimetype: 'image/png',
    size: 15,
  } as Express.Multer.File;

  const mockResponse: InferenceResponse = {
    success: true,
    filename: 'test.png',
    model: 'best.pt',
    confidence_threshold: 0.25,
    processing_time_ms: 35.43,
    result: {
      image_width: 640,
      image_height: 480,
      total_detections: 1,
      detections: [
        {
          class_id: 0,
          class_name: 'person',
          confidence: 0.95,
          bbox: {
            x1: 10,
            y1: 20,
            x2: 100,
            y2: 200,
          },
        },
      ],
    },
  };

  const detectionService = {
    detect: vi.fn(),
  };

  beforeEach(async () => {
    detectionService.detect.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [DetectionController],
      providers: [
        {
          provide: DetectionService,
          useValue: detectionService,
        },
      ],
    }).compile();

    controller = moduleRef.get(DetectionController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return inference results for a valid image', async () => {
    detectionService.detect.mockResolvedValue(mockResponse);

    const result = await controller.detect(mockFile);

    expect(result).toEqual(mockResponse);
    expect(detectionService.detect).toHaveBeenCalledOnce();
    expect(detectionService.detect).toHaveBeenCalledWith(mockFile);
  });

  it('should reject when no image file is provided', async () => {
    await expect(controller.detect(undefined)).rejects.toThrow(
      BadRequestException,
    );

    expect(detectionService.detect).not.toHaveBeenCalled();
  });

  it('should propagate errors from DetectionService', async () => {
    const error = new Error('Inference service unavailable');

    detectionService.detect.mockRejectedValue(error);

    await expect(controller.detect(mockFile)).rejects.toThrow(error);
  });
});
