import { Component, input, output } from '@angular/core';

@Component({
  selector: 'cv-detection-filters',
  standalone: true,
  templateUrl: './detection-filters.html',
  styleUrl: './detection-filters.scss',
})
export class DetectionFilters {
  readonly minimumConfidence = input.required<number>();
  readonly availableClasses = input.required<string[]>();
  readonly classVisibility = input.required<Record<string, boolean>>();
  readonly totalDetections = input.required<number>();
  readonly visibleDetections = input.required<number>();

  readonly confidenceChange = output<number>();
  readonly classToggle = output<{
    className: string;
    visible: boolean;
  }>();
  readonly reset = output<void>();

  isClassVisible(className: string): boolean {
    return this.classVisibility()[className] !== false;
  }

  onConfidenceChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = Number(inputElement.value);

    if (Number.isFinite(value)) {
      this.confidenceChange.emit(Math.max(0, Math.min(100, value)));
    }
  }

  onClassChange(className: string, event: Event): void {
    const inputElement = event.target as HTMLInputElement;

    this.classToggle.emit({
      className,
      visible: inputElement.checked,
    });
  }
}
