import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { DetectionService } from '../src/detection/detection.service.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  const mockDetectionResponse = {
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

  const mockDetectionService = {
    detect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DetectionService)
      .useValue(mockDetectionService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDetectionService.detect.mockReset();
  });

  it('GET /api/v1 should return Hello World', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('POST /api/v1/detections should return inference results', async () => {
    mockDetectionService.detect.mockResolvedValue(mockDetectionResponse);

    const response = await request(app.getHttpServer())
      .post('/api/v1/detections')
      .attach('file', Buffer.from('fake-image-data'), {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual(mockDetectionResponse);
    expect(mockDetectionService.detect).toHaveBeenCalledOnce();
  });

  it('should reject requests without an image', async () => {
    await request(app.getHttpServer()).post('/api/v1/detections').expect(400);

    expect(mockDetectionService.detect).not.toHaveBeenCalled();
  });

  it('should reject unsupported MIME types', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/detections')
      .attach('file', Buffer.from('not an image'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(mockDetectionService.detect).not.toHaveBeenCalled();
  });

  it('should reject files larger than 10 MB', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

    await request(app.getHttpServer())
      .post('/api/v1/detections')
      .attach('file', largeBuffer, {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);

    expect(mockDetectionService.detect).not.toHaveBeenCalled();
  });

  it('should propagate inference service errors', async () => {
    mockDetectionService.detect.mockRejectedValue(
      new Error('Inference service unavailable'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/detections')
      .attach('file', Buffer.from('fake-image-data'), {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(500);
  });
});
