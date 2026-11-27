import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AnalyticsService } from './analytics.service';
import { API_CONFIG } from '../config/api.config';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AnalyticsService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch analytics overview successfully', () => {
    const mockResponse = {
      success: true,
      data: {
        summary: {
          totalImages: 3,
          totalObjects: 13,
          averageProcessingTimeMs: 2737.91,
          averageObjectsPerImage: 4.33,
        },
        classDistribution: [
          { className: 'person', count: 10 },
          { className: 'dog', count: 1 },
          { className: 'car', count: 1 },
          { className: 'bicycle', count: 1 },
        ],
        activity: [
          {
            date: '2026-11-24',
            totalImages: 0,
            totalObjects: 0,
          },
        ],
      },
    };

    service.getOverview().subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.data.summary.totalImages).toBe(3);
      expect(response.data.summary.totalObjects).toBe(13);
      expect(response.data.classDistribution).toHaveLength(4);
    });

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyticsOverview}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(mockResponse);
  });

  it('should propagate API errors', () => {
    let receivedError: unknown;

    service.getOverview().subscribe({
      error: (error: unknown) => {
        receivedError = error;
      },
    });

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyticsOverview}`,
    );

    request.flush(
      { message: 'Internal server error' },
      {
        status: 500,
        statusText: 'Internal Server Error',
      },
    );

    expect(receivedError).toBeTruthy();
  });
});
