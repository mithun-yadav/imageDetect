import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Monitoring } from './monitoring';
import { MonitoringService } from '../../core/services/monitoring.service';
import { MonitoringOverviewResponse } from '../../shared/models/monitoring.model';

describe('Monitoring', () => {
  let fixture: ComponentFixture<Monitoring>;
  let component: Monitoring;
  let monitoringService: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  const mockHistorical = {
    available: true,
    range: '24h' as const,
    startDate: '2026-11-26T12:00:00.000Z',
    endDate: '2026-11-27T12:00:00.000Z',
    summary: {
      totalAttempts: 10,
      successfulInferences: 8,
      failedInferences: 2,
      successRate: 80,
      failureRate: 20,
      averageProcessingTimeMs: 100.5,
      averageRequestDurationMs: 120.5,
      p95RequestDurationMs: 180.25,
    },
    trends: [
      {
        timestamp: '2026-11-27T11:00:00.000Z',
        total: 10,
        successful: 8,
        failed: 2,
        averageRequestDurationMs: 120.5,
      },
    ],
    modelPerformance: [],
    errorDistribution: [],
    recentActivity: [],
  };

  const mockResponse: MonitoringOverviewResponse = {
    success: true,
    data: {
      api: {
        status: 'healthy',
        uptimeSeconds: 90061,
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
          uptimeSeconds: 3600,
        },
      },
      historical: mockHistorical,
    },
  };

  beforeEach(async () => {
    monitoringService = {
      getOverview: vi.fn().mockReturnValue(of(mockResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [Monitoring],
      providers: [
        {
          provide: MonitoringService,
          useValue: monitoringService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Monitoring);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should request monitoring data on initialization', () => {
    expect(monitoringService.getOverview).toHaveBeenCalledTimes(1);
  });

  it('should render service health information', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Model Monitoring');
    expect(text).toContain('Backend API');
    expect(text).toContain('PostgreSQL');
    expect(text).toContain('Inference Service');
    expect(text).toContain('All systems operational');
  });

  it('should render model configuration', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('best.pt');
    expect(text).toContain('Ultralytics YOLO');
    expect(text).toContain('8.4.203');
    expect(text).toContain('person');
    expect(text).toContain('bicycle');
    expect(text).toContain('car');
    expect(text).toContain('dog');
  });

  it('should render inference performance metrics', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('TOTAL ATTEMPTS');
    expect(text).toContain('SUCCESS RATE');
    expect(text).toContain('FAILED INFERENCES');
    expect(text).toContain('AVERAGE LATENCY');

    expect(text).toContain('120.50 ms');
    expect(text).toContain('80.00%');
  });

  it('should render inference reliability distribution', () => {
    fixture.detectChanges();

    const distribution = fixture.nativeElement.querySelector('.distribution-bar');

    expect(distribution).toBeTruthy();
    expect(distribution.getAttribute('aria-label')).toContain('8 successful');
    expect(distribution.getAttribute('aria-label')).toContain('2 failed');

    expect(fixture.nativeElement.querySelector('.distribution-success').style.width).toBe('80%');

    expect(fixture.nativeElement.querySelector('.distribution-failure').style.width).toBe('20%');
  });

  it('should show loading state while the request is pending', () => {
    const pendingRequest = new Subject<MonitoringOverviewResponse>();

    monitoringService.getOverview.mockReturnValue(pendingRequest);

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading system monitoring...');

    expect(fixture.nativeElement.querySelector('.service-grid')).toBeNull();

    pendingRequest.next(mockResponse);
    pendingRequest.complete();

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.service-grid')).toBeTruthy();
  });

  it('should show an error state when the initial request fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    monitoringService.getOverview.mockReturnValue(throwError(() => new Error('API unavailable')));

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    expect(fixture.nativeElement.textContent).toContain('Unable to load monitoring data');
  });

  it('should retry after an initial request failure', () => {
    fixture.destroy();
    monitoringService.getOverview.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    monitoringService.getOverview
      .mockReturnValueOnce(throwError(() => new Error('API unavailable')))
      .mockReturnValueOnce(of(mockResponse));

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-state')).toBeTruthy();

    const retryButton = fixture.nativeElement.querySelector(
      '.error-state .primary-button',
    ) as HTMLButtonElement;

    retryButton.click();
    fixture.detectChanges();

    expect(monitoringService.getOverview).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.service-grid')).toBeTruthy();
  });

  it('should reload monitoring data when Refresh is clicked', () => {
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      '.refresh-button',
    ) as HTMLButtonElement;

    refreshButton.click();
    fixture.detectChanges();

    expect(monitoringService.getOverview).toHaveBeenCalledTimes(2);
  });

  it('should show degraded status when a service is unavailable', () => {
    monitoringService.getOverview.mockReturnValue(
      of({
        ...mockResponse,
        data: {
          ...mockResponse.data,
          inference: {
            status: 'unavailable',
            model: null,
            metrics: null,
          },
        },
      }),
    );

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('System degraded');
    expect(fixture.nativeElement.textContent).toContain('Inference metrics unavailable');
    expect(fixture.nativeElement.textContent).toContain('Model information unavailable');

    // API and database remain visible.
    expect(fixture.nativeElement.textContent).toContain('Backend API');
    expect(fixture.nativeElement.textContent).toContain('PostgreSQL');
  });

  it('should handle zero inference attempts without displaying reliability distribution', () => {
    monitoringService.getOverview.mockReturnValue(
      of({
        ...mockResponse,
        data: {
          ...mockResponse.data,
          inference: {
            ...mockResponse.data.inference,
            metrics: {
              ...mockResponse.data.inference.metrics!,
              totalAttempts: 0,
              successfulInferences: 0,
              failedInferences: 0,
              successRate: null,
              averageLatencyMs: null,
              minLatencyMs: null,
              maxLatencyMs: null,
              lastLatencyMs: null,
              lastInferenceAt: null,
            },
          },
        },
      }),
    );

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('No inference activity recorded');
    expect(text).not.toContain('No inference metrics available');
    expect(fixture.nativeElement.querySelector('.distribution-bar')).toBeNull();
  });

  it('should show an inline error and retain existing data when a refresh fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    monitoringService.getOverview
      .mockReturnValueOnce(of(mockResponse))
      .mockReturnValueOnce(throwError(() => new Error('Temporary API failure')));

    fixture = TestBed.createComponent(Monitoring);
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      '.refresh-button',
    ) as HTMLButtonElement;

    refreshButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inline-error')).toBeTruthy();

    expect(fixture.nativeElement.textContent).toContain('best.pt');
    expect(fixture.nativeElement.textContent).toContain('Backend API');
  });

  it('should format uptime correctly', () => {
    expect(component['formatUptime'](90061)).toBe('1d 1h 1m');
    expect(component['formatUptime'](3660)).toBe('1h 1m');
    expect(component['formatUptime'](125)).toBe('2m 5s');
    expect(component['formatUptime'](45)).toBe('45s');
    expect(component['formatUptime'](null)).toBe('—');
  });

  it('should format latency and percentage values', () => {
    expect(component['formatLatency'](120.5)).toBe('120.50 ms');
    expect(component['formatLatency'](null)).toBe('—');

    expect(component['formatPercentage'](80)).toBe('80.00%');
    expect(component['formatPercentage'](null)).toBe('—');
  });

  it('should refresh monitoring data every 30 seconds', () => {
    fixture.destroy();
    monitoringService.getOverview.mockClear();

    vi.useFakeTimers();

    try {
      fixture = TestBed.createComponent(Monitoring);
      fixture.detectChanges();

      expect(monitoringService.getOverview).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(29_999);
      expect(monitoringService.getOverview).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(monitoringService.getOverview).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(30_000);
      expect(monitoringService.getOverview).toHaveBeenCalledTimes(3);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });
});
