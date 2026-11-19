import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DetectionService } from '../../core/services/detection.service';
import { DetectionResponse } from '../../shared/models/detection.model';
import { DetectionFilters } from './components/detection-filters/detection-filters';
import { DetectionResults } from './components/detection-results/detection-results';
import {
  DetectionPreview,
  type DetectionOverlayItem,
} from './components/detection-preview/detection-preview';

@Component({
  selector: 'cv-workspace',
  standalone: true,
  imports: [DetectionFilters, DetectionResults, DetectionPreview],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace implements OnDestroy {
  private readonly detectionService = inject(DetectionService);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly result = signal<DetectionResponse | null>(null);
  protected readonly isProcessing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isDragging = signal(false);

  protected readonly classVisibility = signal<Record<string, boolean>>({});

  protected readonly hasFile = computed(() => this.selectedFile() !== null);

  protected readonly minimumConfidence = signal(0);

  protected isClassVisible(className: string): boolean {
    return this.classVisibility()[className] !== false;
  }

  protected toggleClass(className: string, visible: boolean): void {
    this.classVisibility.update((current) => ({
      ...current,
      [className]: visible,
    }));
  }

  protected onConfidenceChange(value: string): void {
    const confidence = Number(value);

    if (Number.isFinite(confidence)) {
      this.minimumConfidence.set(Math.max(0, Math.min(100, confidence)));
    }
  }

  protected resetFilters(): void {
    this.minimumConfidence.set(0);
    this.classVisibility.set({});
  }

  protected readonly detections = computed(() => {
    const minimum = this.minimumConfidence() / 100;
    const visibility = this.classVisibility();

    return this.allDetections().filter(
      (detection) => detection.confidence >= minimum && visibility[detection.class_name] !== false,
    );
  });

  protected readonly allDetections = computed(() => this.result()?.result.detections ?? []);

  protected readonly classSummary = computed(() => {
    const counts = new Map<string, number>();

    for (const detection of this.detections()) {
      counts.set(detection.class_name, (counts.get(detection.class_name) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  protected readonly availableClasses = computed(() => {
    return [...new Set(this.allDetections().map((detection) => detection.class_name))].sort();
  });

  protected readonly confidenceThreshold = computed(
    () => this.result()?.confidence_threshold ?? null,
  );

  private objectUrl: string | null = null;
  protected readonly Math = Math;

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.selectFile(file);
    }

    // Allow selecting the same file again.
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files?.[0];

    if (file) {
      this.selectFile(file);
    }
  }

  protected selectFile(file: File): void {
    this.errorMessage.set(null);

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Please select a valid image file.');
      return;
    }

    if (this.isProcessing()) {
      return;
    }

    this.releasePreviewUrl();

    this.selectedFile.set(file);
    this.result.set(null);

    this.objectUrl = URL.createObjectURL(file);
    this.previewUrl.set(this.objectUrl);
  }

  protected removeFile(): void {
    if (this.isProcessing()) {
      return;
    }

    this.releasePreviewUrl();
    this.selectedFile.set(null);
    this.result.set(null);
    this.errorMessage.set(null);
  }

  protected runDetection(): void {
    const file = this.selectedFile();

    if (!file || this.isProcessing()) {
      return;
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.result.set(null);

    this.detectionService.detectImage(file).subscribe({
      next: (response) => {
        if (!response.success) {
          this.errorMessage.set('The detection request was not successful.');
          return;
        }

        this.result.set(response);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isProcessing.set(false);
      },
      complete: () => {
        this.isProcessing.set(false);
      },
    });
  }

  protected formatConfidence(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Unable to connect to the detection service. Check that the API is running.';
    }

    if (error.status === 400) {
      return error.error?.message ?? 'The uploaded image was rejected.';
    }

    if (error.status === 413) {
      return 'The image is too large for the server to process.';
    }

    return error.error?.message ?? 'Detection failed. Please try again.';
  }

  private releasePreviewUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    this.previewUrl.set(null);
  }

  ngOnDestroy(): void {
    this.releasePreviewUrl();
  }

  protected readonly imageAspectRatio = computed(() => {
    const result = this.result()?.result;

    if (!result) return 'auto';

    return `${result.image_width} / ${result.image_height}`;
  });

  protected getClassColor(classId: number): string {
    const colors = [
      '#06B6D4',
      '#F59E0B',
      '#8B5CF6',
      '#10B981',
      '#EF4444',
      '#3B82F6',
      '#EC4899',
      '#84CC16',
    ];

    return colors[classId % colors.length];
  }

  protected readonly showAnnotations = signal(true);

  protected toggleAnnotations(show: boolean): void {
    this.showAnnotations.set(show);
  }

  protected readonly overlayDetections = computed(() => {
    const response = this.result()?.result;

    if (!response) return [];

    const imageWidth = response.image_width;
    const imageHeight = response.image_height;

    const labelHeight = 22;
    const fontSize = 12;
    const horizontalPadding = 7;

    const occupiedLabels: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const detections = this.detections().map((detection, id) => ({ detection, id }));

    const annotations: DetectionOverlayItem[] = [];

    for (const { detection, id } of detections) {
      const { x1, y1, x2, y2 } = detection.bbox;

      const boxX = Math.max(0, Math.min(x1, imageWidth));
      const boxY = Math.max(0, Math.min(y1, imageHeight));
      const boxRight = Math.max(boxX, Math.min(x2, imageWidth));
      const boxBottom = Math.max(boxY, Math.min(y2, imageHeight));

      const text = `${detection.class_name} ${this.formatConfidence(detection.confidence)}`;

      // Approximate text width for the SVG font.
      const labelWidth = Math.min(imageWidth, Math.ceil(text.length * 7.2 + horizontalPadding * 2));

      const boxWidth = boxRight - boxX;
      const boxHeight = boxBottom - boxY;

      const preferredX = Math.max(0, Math.min(boxX, imageWidth - labelWidth));

      const alternativeX = Math.max(0, Math.min(boxRight - labelWidth, imageWidth - labelWidth));

      const centeredX = Math.max(
        0,
        Math.min(boxX + (boxWidth - labelWidth) / 2, imageWidth - labelWidth),
      );

      const candidatePositions = [
        { x: preferredX, y: boxY - labelHeight },
        { x: preferredX, y: boxY },
        { x: preferredX, y: boxBottom - labelHeight },
        { x: alternativeX, y: boxY - labelHeight },
        { x: alternativeX, y: boxBottom - labelHeight },
        { x: centeredX, y: boxY },
        { x: preferredX, y: boxBottom },
      ].map((position) => ({
        x: position.x,
        y: Math.max(0, Math.min(position.y, imageHeight - labelHeight)),
      }));

      const overlaps = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ): boolean =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

      const candidate = candidatePositions.find((position) => {
        const label = {
          ...position,
          width: labelWidth,
          height: labelHeight,
        };

        return !occupiedLabels.some((occupied) => overlaps(label, occupied));
      });

      // If every position overlaps, choose the position with the least
      // overlap rather than allowing the label to leave the image.
      const selectedPosition =
        candidate ??
        candidatePositions.reduce((best, position) => {
          const label = {
            ...position,
            width: labelWidth,
            height: labelHeight,
          };

          const overlapCount = occupiedLabels.filter((occupied) =>
            overlaps(label, occupied),
          ).length;

          const bestOverlapCount = occupiedLabels.filter((occupied) =>
            overlaps(
              {
                ...best,
                width: labelWidth,
                height: labelHeight,
              },
              occupied,
            ),
          ).length;

          return overlapCount < bestOverlapCount ? position : best;
        });

      occupiedLabels.push({
        ...selectedPosition,
        width: labelWidth,
        height: labelHeight,
      });

      annotations.push({
        id,
        x: boxX,
        y: boxY,
        width: boxRight - boxX,
        height: boxBottom - boxY,
        color: this.getClassColor(detection.class_id),
        label: text,
        labelX: selectedPosition.x,
        labelY: selectedPosition.y,
        labelWidth,
        labelHeight,
      });
    }

    return annotations;
  });
}
