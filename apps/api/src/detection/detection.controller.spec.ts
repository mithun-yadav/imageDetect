import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

import { DetectionController } from './detection.controller.js';
import { DetectionService } from './detection.service.js';
import type { InferenceResponse } from './detection.service.js';
import { GetDetectionsQueryDto } from './dto/get-detections-query.dto.js';

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
    findAll: vi.fn(),
    findImage: vi.fn(),
  };

  beforeEach(async () => {
    detectionService.detect.mockReset();
    detectionService.findAll.mockReset();
    detectionService.findImage.mockReset();

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

  describe('findAll', () => {
    const mockHistoryResponse = {
      success: true,
      data: [
        {
          id: '73005360-02a3-4f2c-8557-f766e87f2e5f',
          filename: 'train-image-9.jpg',
          model: 'best.pt',
          processingTimeMs: 2125.5,
          imageWidth: 612,
          imageHeight: 241,
          totalDetections: 5,
          createdAt: new Date('2026-11-20T10:08:23.454Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated detection history', async () => {
      detectionService.findAll.mockResolvedValue(mockHistoryResponse);

      const query = {
        page: 1,
        limit: 10,
      } as GetDetectionsQueryDto;

      const result = await controller.findAll(query);

      expect(result).toEqual(mockHistoryResponse);
      expect(detectionService.findAll).toHaveBeenCalledOnce();
      expect(detectionService.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass pagination parameters to DetectionService', async () => {
      detectionService.findAll.mockResolvedValue(mockHistoryResponse);

      const query = {
        page: 2,
        limit: 20,
      } as GetDetectionsQueryDto;

      await controller.findAll(query);

      expect(detectionService.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
      });
    });

    it('should propagate errors from DetectionService', async () => {
      const error = new Error('Database connection failed');

      detectionService.findAll.mockRejectedValue(error);

      await expect(
        controller.findAll({
          page: 1,
          limit: 10,
        } as GetDetectionsQueryDto),
      ).rejects.toThrow(error);
    });
  });

  describe('findImage', () => {
    const detectionId = '73005360-02a3-4f2c-8557-f766e87f2e5f';
    const imageBuffer = Buffer.from('fake-image-data');

    let response: {
      set: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      response = {
        set: vi.fn().mockReturnThis(),
        end: vi.fn(),
      };
    });

    it('should return the original image with correct headers', async () => {
      detectionService.findImage.mockResolvedValue({
        buffer: imageBuffer,
        mimeType: 'image/jpeg',
        filename: 'train-image-9.jpg',
      });

      await controller.findImage(detectionId, response as unknown as Response);

      expect(detectionService.findImage).toHaveBeenCalledOnce();
      expect(detectionService.findImage).toHaveBeenCalledWith(detectionId);

      expect(response.set).toHaveBeenCalledWith({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });

      expect(response.end).toHaveBeenCalledWith(imageBuffer);
    });

    it.each([
      ['image/jpeg', 'train-image.jpg'],
      ['image/png', 'train-image.png'],
      ['image/webp', 'train-image.webp'],
    ])('should support %s images', async (mimeType, filename) => {
      detectionService.findImage.mockResolvedValue({
        buffer: imageBuffer,
        mimeType,
        filename,
      });

      await controller.findImage(detectionId, response as unknown as Response);

      expect(response.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': mimeType,
        }),
      );

      expect(response.end).toHaveBeenCalledWith(imageBuffer);
    });

    it('should propagate NotFoundException when the image is unavailable', async () => {
      detectionService.findImage.mockRejectedValue(
        new NotFoundException('Stored image not found'),
      );

      await expect(
        controller.findImage(detectionId, response as unknown as Response),
      ).rejects.toThrow(NotFoundException);

      expect(response.end).not.toHaveBeenCalled();
    });

    it('should propagate unexpected service errors', async () => {
      const error = new Error('Database connection failed');

      detectionService.findImage.mockRejectedValue(error);

      await expect(
        controller.findImage(detectionId, response as unknown as Response),
      ).rejects.toThrow(error);
    });
  });
});
