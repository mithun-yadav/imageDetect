import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MonitoringService } from './monitoring.service';
import { API_CONFIG } from '../config/api.config';
import { MonitoringOverviewResponse } from '../../shared/models/monitoring.model';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let httpTestingController: HttpTestingController;

  const mockResponse: MonitoringOverviewResponse = {
    success: true,
    data: {
      api: {
        status: 'healthy',
        uptimeSeconds: 3600,
      },
      database: {
        status: 'healthy',
        responseTimeMs: 12.5,
      },
      inference: {
        status: 'healthy',
        model: {
          loaded: true,
          name: 'best.pt',
          framework: 'Ultralytics YOLO',
          frameworkVersion: '8.4.203',
          device: 'cpu',
          confidenceThreshold: 0.25,
          imageSize: 640,
          classNames: ['person', 'bicycle', 'car', 'dog'],
        },
        metrics: {
          totalAttempts: 10,
          successfulInferences: 8,
          failedInferences: 2,
          successRate: 80,
          averageLatencyMs: 120.5,
          minLatencyMs: 80,
          maxLatencyMs: 200,
          lastLatencyMs: 110,
          lastInferenceAt: '2026-11-25T10:30:00.000Z',
          uptimeSeconds: 1800,
        },
      },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MonitoringService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(MonitoringService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch monitoring overview successfully', () => {
    service.getOverview().subscribe((response) => {
      expect(response).toEqual(mockResponse);
      expect(response.success).toBe(true);
      expect(response.data.api.status).toBe('healthy');
      expect(response.data.database.responseTimeMs).toBe(12.5);
      expect(response.data.inference.model?.name).toBe('best.pt');
      expect(response.data.inference.metrics?.totalAttempts).toBe(10);
    });

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
    );

    expect(request.request.method).toBe('GET');

    request.flush(mockResponse);
  });

  it('should use the configured monitoring overview endpoint', () => {
    service.getOverview().subscribe();

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
    );

    expect(request.request.url).toBe(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
    );

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
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
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

  it('should support partial service availability', () => {
    const partialResponse: MonitoringOverviewResponse = {
      success: true,
      data: {
        api: {
          status: 'healthy',
          uptimeSeconds: 3600,
        },
        database: {
          status: 'healthy',
          responseTimeMs: 10,
        },
        inference: {
          status: 'unavailable',
          model: null,
          metrics: null,
        },
      },
    };

    service.getOverview().subscribe((response) => {
      expect(response.data.api.status).toBe('healthy');
      expect(response.data.database.status).toBe('healthy');
      expect(response.data.inference.status).toBe('unavailable');
      expect(response.data.inference.model).toBeNull();
      expect(response.data.inference.metrics).toBeNull();
    });

    const request = httpTestingController.expectOne(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
    );

    request.flush(partialResponse);
  });
});
