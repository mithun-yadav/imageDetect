import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { HistoryDetail } from './history-detail';
import { DetectionService } from '../../core/services/detection.service';
import { DetectionDetailResponse } from '../../shared/models/detection-history.model';

describe('HistoryDetail', () => {
  const detectionId = '030c7a88-39e4-47e8-9d03-362e0ff6e74a';

  const mockResponse: DetectionDetailResponse = {
    success: true,
    data: {
      id: detectionId,
      filename: 'train-image-3.jpg',
      model: 'best.pt',
      confidenceThreshold: 0.25,
      processingTimeMs: 5757.95,
      imageWidth: 612,
      imageHeight: 408,
      totalDetections: 1,
      createdAt: '2026-11-23T13:46:47.054Z',
      detections: [
        {
          id: '6bded35d-04d5-4f47-82cd-af9da99d0ba3',
          classId: 0,
          className: 'person',
          confidence: 0.8209171891212463,
          bbox: {
            x1: 219.08,
            y1: 109.42,
            x2: 318.49,
            y2: 353.31,
          },
        },
      ],
    },
  };

  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  let detectionService: {
    getDetails: ReturnType<typeof vi.fn>;
    getOriginalImageUrl: ReturnType<typeof vi.fn>;
  };

  let router: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ id: detectionId }));

    detectionService = {
      getDetails: vi.fn().mockReturnValue(of(mockResponse)),
      getOriginalImageUrl: vi.fn().mockReturnValue(`/api/v1/detections/${detectionId}/image`),
    };

    router = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HistoryDetail],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
          },
        },
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(HistoryDetail);
    fixture.detectChanges();

    return fixture;
  }

  it('should create the component', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load detection details using the route ID', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(detectionService.getDetails).toHaveBeenCalledWith(detectionId);
    expect(component.detail()).toEqual(mockResponse.data);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should generate the original image URL', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(detectionService.getOriginalImageUrl).toHaveBeenCalledWith(detectionId);

    expect(component.imageUrl()).toBe(`/api/v1/detections/${detectionId}/image`);
  });

  it('should display detection metadata', () => {
    const fixture = createComponent();

    expect(fixture.nativeElement.textContent).toContain('train-image-3.jpg');

    expect(fixture.nativeElement.textContent).toContain('best.pt');
    expect(fixture.nativeElement.textContent).toContain('612');
  });

  it('should display detected objects and confidence', () => {
    const fixture = createComponent();

    expect(fixture.nativeElement.textContent).toContain('person');
    expect(fixture.nativeElement.textContent).toContain('82.09%');
  });

  it('should calculate bounding-box width correctly', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.getBoxWidth(219.08, 318.49)).toBeCloseTo(99.41);
  });

  it('should calculate bounding-box height correctly', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.getBoxHeight(109.42, 353.31)).toBeCloseTo(243.89);
  });

  it('should prevent negative bounding-box dimensions', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.getBoxWidth(200, 100)).toBe(0);
    expect(component.getBoxHeight(200, 100)).toBe(0);
  });

  it('should format confidence as a percentage', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.formatConfidence(0.820917)).toBe('82.09%');
  });

  it('should navigate back to history', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/history']);
  });

  it('should handle detection API errors', () => {
    detectionService.getDetails.mockReturnValue(throwError(() => new Error('Not found')));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(component.loading()).toBe(false);
    expect(component.detail()).toBeNull();
    expect(component.error()).toContain('Unable to load detection details');

    expect(consoleError).toHaveBeenCalled();
  });

  it('should load a new detection when the route ID changes', () => {
    const fixture = createComponent();

    const nextId = '73005360-02a3-4f2c-8557-f766e87f2e5f';

    const nextResponse: DetectionDetailResponse = {
      ...mockResponse,
      data: {
        ...mockResponse.data,
        id: nextId,
        filename: 'train-image-9.jpg',
      },
    };

    detectionService.getDetails.mockReturnValue(of(nextResponse));
    detectionService.getOriginalImageUrl.mockReturnValue(`/api/v1/detections/${nextId}/image`);

    routeParams.next(convertToParamMap({ id: nextId }));
    fixture.detectChanges();

    const component = fixture.componentInstance as any;

    expect(detectionService.getDetails).toHaveBeenLastCalledWith(nextId);
    expect(component.detail().filename).toBe('train-image-9.jpg');
    expect(component.imageUrl()).toBe(`/api/v1/detections/${nextId}/image`);
  });

  it('should display fallback when the original image fails to load', () => {
    const fixture = createComponent();

    const image = fixture.nativeElement.querySelector('.original-image') as HTMLImageElement;

    expect(image).toBeTruthy();

    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.image-error')).toBeTruthy();

    expect(fixture.nativeElement.textContent).toContain('Original image unavailable');
  });
});
