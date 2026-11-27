import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { History } from './history';
import { DetectionService } from '../../core/services/detection.service';
import { DetectionHistoryResponse } from '../../shared/models/detection-history.model';

describe('History', () => {
  const mockResponse: DetectionHistoryResponse = {
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
        createdAt: '2026-11-20T10:08:23.454Z',
      },
    ],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  let detectionService: {
    getHistory: ReturnType<typeof vi.fn>;
  };

  let router: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    detectionService = {
      getHistory: vi.fn().mockReturnValue(of(mockResponse)),
    };

    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [History],
      providers: [
        {
          provide: DetectionService,
          useValue: detectionService,
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(History);
    fixture.detectChanges();

    return fixture;
  }

  it('should create the component', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load history on initialization', () => {
    const fixture = createComponent();

    expect(detectionService.getHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: undefined,
      className: undefined,
      model: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });

    expect(fixture.componentInstance['records']()).toEqual(mockResponse.data);

    expect(fixture.componentInstance['meta']()).toEqual(mockResponse.meta);

    expect(fixture.componentInstance['loading']()).toBe(false);
  });

  it('should display detection records', () => {
    const fixture = createComponent();

    expect(fixture.nativeElement.textContent).toContain('train-image-9.jpg');

    expect(fixture.nativeElement.textContent).toContain('best.pt');
  });

  it('should apply search and filters', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.search.set('train-image');
    component.className.set('person');
    component.model.set('best.pt');
    component.dateFrom.set('2026-11-01');
    component.dateTo.set('2026-11-25');

    component.applyFilters();
    fixture.detectChanges();

    expect(detectionService.getHistory).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      search: 'train-image',
      className: 'person',
      model: 'best.pt',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-25',
    });
  });

  it('should reject an invalid date range', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    const initialCallCount = detectionService.getHistory.mock.calls.length;

    component.dateFrom.set('2026-11-25');
    component.dateTo.set('2026-11-01');

    component.applyFilters();

    expect(detectionService.getHistory).toHaveBeenCalledTimes(initialCallCount);

    expect(component.error()).toBe('Start date cannot be later than end date.');
  });

  it('should reset filters and reload history', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.search.set('test');
    component.className.set('person');
    component.model.set('best.pt');
    component.dateFrom.set('2026-11-01');
    component.dateTo.set('2026-11-25');
    component.page.set(2);

    component.resetFilters();

    expect(component.search()).toBe('');
    expect(component.className()).toBe('');
    expect(component.model()).toBe('');
    expect(component.dateFrom()).toBe('');
    expect(component.dateTo()).toBe('');
    expect(component.page()).toBe(1);

    expect(detectionService.getHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
      }),
    );
  });

  it('should change pages within valid boundaries', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.meta.set({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });

    component.changePage(2);

    expect(component.page()).toBe(2);

    expect(detectionService.getHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
      }),
    );
  });

  it('should ignore invalid page changes', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.meta.set({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });

    const initialCallCount = detectionService.getHistory.mock.calls.length;

    component.changePage(4);

    expect(component.page()).toBe(1);

    expect(detectionService.getHistory).toHaveBeenCalledTimes(initialCallCount);
  });

  it('should change page size and reset to page one', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.page.set(2);
    component.changeLimit('20');

    expect(component.limit()).toBe(20);
    expect(component.page()).toBe(1);

    expect(detectionService.getHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    );
  });

  it('should navigate to detection details', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    const id = '73005360-02a3-4f2c-8557-f766e87f2e5f';

    component.openDetails(id);

    expect(router.navigate).toHaveBeenCalledWith(['/history', id]);
  });

  it('should handle history API errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    detectionService.getHistory.mockReturnValue(throwError(() => new Error('Network error')));

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.loading()).toBe(false);

    expect(component.error()).toBe('Unable to load detection history. Please try again.');

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load detection history:',
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it('should ignore stale responses when a newer request is triggered', () => {
    const firstRequest = new Subject<DetectionHistoryResponse>();
    const secondRequest = new Subject<DetectionHistoryResponse>();

    detectionService.getHistory
      .mockReturnValueOnce(firstRequest.asObservable())
      .mockReturnValueOnce(secondRequest.asObservable());

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    // Trigger a newer request before the first request completes.
    component.search.set('latest-search');
    component.applyFilters();

    // Emit an old response. It must not update the component.
    firstRequest.next({
      ...mockResponse,
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    expect(component.records()).toEqual([]);
    expect(component.loading()).toBe(true);

    // Emit the latest response.
    const latestResponse: DetectionHistoryResponse = {
      ...mockResponse,
      data: [
        {
          ...mockResponse.data[0],
          filename: 'latest-result.jpg',
        },
      ],
    };

    secondRequest.next(latestResponse);

    expect(component.records()).toEqual(latestResponse.data);
    expect(component.loading()).toBe(false);
  });
});
