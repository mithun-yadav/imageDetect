import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DetectionService } from './detection.service';
import { API_CONFIG } from '../config/api.config';

describe('DetectionService', () => {
  let service: DetectionService;
  let httpTestingController: HttpTestingController;

  const detectionId = '73005360-02a3-4f2c-8557-f766e87f2e5f';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DetectionService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(DetectionService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch paginated detection history', () => {
    const mockResponse = {
      success: true,
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    };

    service.getHistory({ page: 1, limit: 10 }).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const request = httpTestingController.expectOne(
      (req) => req.url === `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('10');

    request.flush(mockResponse);
  });

  it('should send all supplied history filters', () => {
    service
      .getHistory({
        page: 2,
        limit: 20,
        search: 'train-image',
        className: 'person',
        model: 'best.pt',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-24',
      })
      .subscribe();

    const request = httpTestingController.expectOne(
      (req) => req.url === `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
    );

    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('search')).toBe('train-image');
    expect(request.request.params.get('className')).toBe('person');
    expect(request.request.params.get('model')).toBe('best.pt');
    expect(request.request.params.get('dateFrom')).toBe('2026-11-01');
    expect(request.request.params.get('dateTo')).toBe('2026-11-24');

    request.flush({
      success: true,
      data: [],
      meta: { page: 2, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('should omit empty optional filters', () => {
    service
      .getHistory({
        page: 1,
        limit: 10,
        search: '',
        className: undefined,
      })
      .subscribe();

    const request = httpTestingController.expectOne(
      (req) => req.url === `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
    );

    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.has('className')).toBe(false);

    request.flush({
      success: true,
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('should fetch detection details by ID', () => {
    const mockResponse = {
      success: true,
      data: {
        id: detectionId,
        filename: 'train-image-9.jpg',
        model: 'best.pt',
        confidenceThreshold: 0.25,
        processingTimeMs: 2125.5,
        imageWidth: 612,
        imageHeight: 241,
        totalDetections: 0,
        detections: [],
        createdAt: '2026-11-20T10:08:23.454Z',
      },
    };

    service.getDetails(detectionId).subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.data.id).toBe(detectionId);
    });

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}/${detectionId}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(mockResponse);
  });

  it('should generate the original image URL', () => {
    const imageUrl = service.getOriginalImageUrl(detectionId);

    expect(imageUrl).toBe(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}/${detectionId}/image`,
    );
  });

  it('should preserve the existing image detection upload behavior', () => {
    const file = new File(['image-content'], 'test-image.jpg', {
      type: 'image/jpeg',
    });

    service.detectImage(file).subscribe();

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('file')).toBeTruthy();

    request.flush({
      success: true,
      filename: 'test-image.jpg',
      model: 'best.pt',
      confidence_threshold: 0.25,
      processing_time_ms: 42.5,
      result: {
        image_width: 640,
        image_height: 480,
        total_detections: 0,
        detections: [],
      },
    });
  });
});
