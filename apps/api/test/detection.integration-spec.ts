import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const IMAGE_PATH = resolve(process.cwd(), '../../data/images/test.png');

describe('Real YOLO integration', () => {
  it('should detect objects through NestJS and the real Python inference service', async () => {
    if (!existsSync(IMAGE_PATH)) {
      throw new Error(`Test image not found: ${IMAGE_PATH}`);
    }

    const readiness = await fetch(`${API_URL}/api/v1/health/ready`);

    expect(readiness.status).toBe(200);

    const health = await readiness.json();

    expect(health.status).toBe('ok');
    expect(health.info.inference.modelLoaded).toBe(true);

    const response = await request(API_URL)
      .post('/api/v1/detections')
      .attach('file', IMAGE_PATH);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.filename).toBe('test.png');
    expect(response.body.result.image_width).toBeGreaterThan(0);
    expect(response.body.result.image_height).toBeGreaterThan(0);
    expect(response.body.result.total_detections).toBeGreaterThan(0);
    expect(response.body.result.detections).toHaveLength(
      response.body.result.total_detections,
    );

    for (const detection of response.body.result.detections) {
      expect(detection.class_name).toEqual(expect.any(String));
      expect(detection.confidence).toBeGreaterThanOrEqual(0.25);
      expect(detection.confidence).toBeLessThanOrEqual(1);
      expect(detection.bbox.x1).toBeLessThan(detection.bbox.x2);
      expect(detection.bbox.y1).toBeLessThan(detection.bbox.y2);
    }

    console.log({
      model: response.body.model,
      image: `${response.body.result.image_width}x${response.body.result.image_height}`,
      detections: response.body.result.total_detections,
      processingTimeMs: response.body.processing_time_ms,
    });
  }, 60_000);
});
