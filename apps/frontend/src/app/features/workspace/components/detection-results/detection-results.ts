import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Detection, DetectionResponse } from '../../../../shared/models/detection.model';

interface ClassSummaryItem {
  name: string;
  count: number;
}

@Component({
  selector: 'cv-detection-results',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './detection-results.html',
  styleUrl: './detection-results.scss',
})
export class DetectionResults {
  readonly result = input<DetectionResponse | null>(null);
  readonly isProcessing = input(false);
  readonly detections = input<Detection[]>([]);
  readonly classSummary = input<ClassSummaryItem[]>([]);

  formatConfidence(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }
}
