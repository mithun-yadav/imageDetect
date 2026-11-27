import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, catchError, EMPTY, finalize } from 'rxjs';

import { DetectionService } from '../../core/services/detection.service';
import { DetectionDetail } from '../../shared/models/detection-history.model';

@Component({
  selector: 'cv-history-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './history-detail.html',
  styleUrl: './history-detail.scss',
})
export class HistoryDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detectionService = inject(DetectionService);

  protected readonly detail = signal<DetectionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly imageError = signal(false);

  protected onImageError(): void {
    this.imageError.set(true);
  }

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');

          if (!id) {
            this.error.set('Detection ID is missing.');
            this.loading.set(false);
            return EMPTY;
          }

          this.loading.set(true);
          this.error.set(null);
          this.detail.set(null);

          return this.detectionService.getDetails(id).pipe(
            catchError((error: unknown) => {
              console.error('Failed to load detection details:', error);

              this.error.set('Unable to load detection details. The record may not exist.');

              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
      )
      .subscribe((response) => {
        this.detail.set(response.data);
        this.imageError.set(false);

        this.imageUrl.set(this.detectionService.getOriginalImageUrl(response.data.id));
      });
  }

  protected goBack(): void {
    void this.router.navigate(['/history']);
  }

  protected formatConfidence(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  protected getBoxWidth(x1: number, x2: number): number {
    return Math.max(0, x2 - x1);
  }

  protected getBoxHeight(y1: number, y2: number): number {
    return Math.max(0, y2 - y1);
  }
}
