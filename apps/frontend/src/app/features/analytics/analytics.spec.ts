import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Analytics } from './analytics';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AnalyticsOverviewResponse } from '../../shared/models/analytics.model';

describe('Analytics', () => {
  let fixture: ComponentFixture<Analytics>;
  let component: Analytics;
  let analyticsService: {
    getOverview: ReturnType<typeof vi.fn>;
  };

  const mockResponse: AnalyticsOverviewResponse = {
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
        { date: '2026-11-20', totalImages: 1, totalObjects: 5 },
        { date: '2026-11-21', totalImages: 0, totalObjects: 0 },
        { date: '2026-11-23', totalImages: 2, totalObjects: 8 },
      ],
    },
  };

  beforeEach(async () => {
    analyticsService = {
      getOverview: vi.fn().mockReturnValue(of(mockResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [Analytics],
      providers: [
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Analytics);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should request analytics data on initialization', () => {
    expect(analyticsService.getOverview).toHaveBeenCalledTimes(1);
  });

  it('should render analytics summary metrics', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Analytics');
    expect(text).toContain('TOTAL IMAGES');
    expect(text).toContain('OBJECTS DETECTED');
    expect(text).toContain('AVG. PROCESSING TIME');
    expect(text).toContain('OBJECTS PER IMAGE');

    expect(text).toContain('3');
    expect(text).toContain('13');
    expect(text).toContain('2,737.91');
    expect(text).toContain('4.33');
  });

  it('should render activity chart data', () => {
    fixture.detectChanges();

    const columns = fixture.nativeElement.querySelectorAll('.activity-column');

    expect(columns.length).toBe(3);

    const nativeElement = fixture.nativeElement as HTMLElement;

    const labelElements = nativeElement.querySelectorAll('.activity-label');

    const labels: string[] = [];

    labelElements.forEach((element: Element) => {
      labels.push(element.textContent?.trim() ?? '');
    });

    expect(labels).toEqual(['Fri', 'Sat', 'Mon']);
  });

  it('should render class distribution', () => {
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.distribution-item');

    expect(items.length).toBe(4);

    const text = fixture.nativeElement.querySelector('.distribution-card').textContent;

    expect(text).toContain('person');
    expect(text).toContain('dog');
    expect(text).toContain('car');
    expect(text).toContain('bicycle');
    expect(text).toContain('76.9%');
  });

  it('should show loading state while the request is pending', () => {
    const pendingRequest = new Subject<AnalyticsOverviewResponse>();

    analyticsService.getOverview.mockReturnValue(pendingRequest);

    fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading analytics...');

    expect(fixture.nativeElement.querySelector('.metrics-grid')).toBeNull();

    pendingRequest.next(mockResponse);
    pendingRequest.complete();

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.metrics-grid')).toBeTruthy();
  });

  it('should show an error message when the API request fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    analyticsService.getOverview.mockReturnValue(throwError(() => new Error('API unavailable')));

    fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load analytics data. Please try again.',
    );

    expect(fixture.nativeElement.querySelector('.metrics-grid')).toBeNull();
  });

  it('should retry loading analytics when Try again is clicked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Ignore the initial request made by beforeEach.
    analyticsService.getOverview.mockClear();

    analyticsService.getOverview
      .mockReturnValueOnce(throwError(() => new Error('API unavailable')))
      .mockReturnValueOnce(of(mockResponse));

    // Trigger the first request, which should fail.
    const refreshButton = fixture.nativeElement.querySelector(
      '.refresh-button',
    ) as HTMLButtonElement;

    refreshButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const retryButton = fixture.nativeElement.querySelector(
      '.error-state .primary-button',
    ) as HTMLButtonElement;

    expect(retryButton).toBeTruthy();

    // Retry should succeed.
    retryButton.click();
    fixture.detectChanges();

    expect(analyticsService.getOverview).toHaveBeenCalledTimes(2);

    expect(fixture.nativeElement.querySelector('.metrics-grid')).toBeTruthy();
  });

  it('should reload analytics when Refresh is clicked', () => {
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      '.refresh-button',
    ) as HTMLButtonElement;

    refreshButton.click();
    fixture.detectChanges();

    expect(analyticsService.getOverview).toHaveBeenCalledTimes(2);
  });

  it('should handle empty analytics data', () => {
    analyticsService.getOverview.mockReturnValue(
      of({
        success: true,
        data: {
          summary: {
            totalImages: 0,
            totalObjects: 0,
            averageProcessingTimeMs: 0,
            averageObjectsPerImage: 0,
          },
          classDistribution: [],
          activity: [],
        },
      }),
    );

    fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No activity data available.');

    expect(fixture.nativeElement.textContent).toContain('No detected objects available.');

    expect(fixture.nativeElement.querySelector('.metrics-grid')).toBeTruthy();
  });
});
