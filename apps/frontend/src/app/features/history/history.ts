import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, map, startWith, switchMap, tap } from 'rxjs';

import { DetectionService } from '../../core/services/detection.service';
import {
  DetectionHistoryItem,
  DetectionHistoryQuery,
  DetectionHistoryMeta,
} from '../../shared/models/detection-history.model';

@Component({
  selector: 'cv-history',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  private readonly detectionService = inject(DetectionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refresh$ = new Subject<void>();

  protected readonly records = signal<DetectionHistoryItem[]>([]);
  protected readonly meta = signal<DetectionHistoryMeta | null>(null);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly className = signal('');
  protected readonly model = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');

  protected readonly page = signal(1);
  protected readonly limit = signal(10);

  constructor() {
    this.refresh$
      .pipe(
        startWith(undefined),
        map(() => this.buildQuery()),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((query) =>
          this.detectionService.getHistory(query).pipe(
            tap((response) => {
              this.records.set(response.data);
              this.meta.set(response.meta);
              this.loading.set(false);
            }),
            catchError((error: unknown) => {
              console.error('Failed to load detection history:', error);

              this.error.set('Unable to load detection history. Please try again.');
              this.loading.set(false);

              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private buildQuery(): DetectionHistoryQuery {
    return {
      page: this.page(),
      limit: this.limit(),
      search: this.search().trim() || undefined,
      className: this.className().trim() || undefined,
      model: this.model().trim() || undefined,
      dateFrom: this.dateFrom() || undefined,
      dateTo: this.dateTo() || undefined,
    };
  }

  protected loadHistory(): void {
    this.refresh$.next();
  }

  protected applyFilters(): void {
    if (this.dateFrom() && this.dateTo() && this.dateFrom() > this.dateTo()) {
      this.error.set('Start date cannot be later than end date.');
      return;
    }

    this.page.set(1);
    this.loadHistory();
  }

  protected resetFilters(): void {
    this.search.set('');
    this.className.set('');
    this.model.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);

    this.loadHistory();
  }

  protected changePage(nextPage: number): void {
    const totalPages = this.meta()?.totalPages ?? 0;

    if (nextPage < 1 || nextPage > totalPages || nextPage === this.page()) {
      return;
    }

    this.page.set(nextPage);
    this.loadHistory();
  }

  protected changeLimit(value: string): void {
    const nextLimit = Number(value);

    if (!Number.isInteger(nextLimit) || nextLimit < 1 || nextLimit > 100) {
      return;
    }

    this.limit.set(nextLimit);
    this.page.set(1);
    this.loadHistory();
  }

  protected openDetails(id: string): void {
    void this.router.navigate(['/history', id]);
  }
}
