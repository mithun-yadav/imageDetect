import { Component, input, output } from '@angular/core';
import type { DetectionResponse } from '../../../../shared/models/detection.model';

export interface DetectionOverlayItem {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
}

@Component({
  selector: 'cv-detection-preview',
  standalone: true,
  templateUrl: './detection-preview.html',
  styleUrl: './detection-preview.scss',
})
export class DetectionPreview {
  readonly previewUrl = input.required<string>();
  readonly selectedFile = input.required<File | null>();
  readonly result = input.required<DetectionResponse | null>();
  readonly isProcessing = input.required<boolean>();
  readonly showAnnotations = input.required<boolean>();
  readonly imageAspectRatio = input.required<string>();
  readonly overlayDetections = input.required<DetectionOverlayItem[]>();

  readonly annotationsToggle = output<boolean>();
  readonly remove = output<void>();

  toggleAnnotations(show: boolean): void {
    this.annotationsToggle.emit(show);
  }

  removeFile(): void {
    this.remove.emit();
  }
}
