import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, exhaustMap, finalize, merge, of, tap, timer } from 'rxjs';

import { MonitoringService } from '../../core/services/monitoring.service';
import { MonitoringOverview, MonitoringRange } from '../../shared/models/monitoring.model';

@Component({
  selector: 'cv-monitoring',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.scss',
})
export class Monitoring {
  private readonly monitoringService = inject(MonitoringService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly manualRefresh$ = new Subject<void>();

  protected readonly monitoring = signal<MonitoringOverview | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly lastUpdated = signal<Date | null>(null);

  protected readonly selectedRange = signal<MonitoringRange>('24h');

  protected readonly availableRanges: {
    label: string;
    value: MonitoringRange;
  }[] = [
    { label: '24 Hours', value: '24h' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
  ];

  protected readonly overallStatus = computed(() => {
    const data = this.monitoring();

    if (!data) {
      return 'unknown';
    }

    const servicesHealthy =
      data.api.status === 'healthy' &&
      data.database.status === 'healthy' &&
      data.inference.status === 'healthy';

    return servicesHealthy ? 'healthy' : 'degraded';
  });

  protected readonly inferenceDistribution = computed(() => {
    const metrics = this.monitoring()?.inference.metrics;

    if (!metrics || metrics.totalAttempts === 0) {
      return {
        successful: 0,
        failed: 0,
        successPercentage: 0,
        failurePercentage: 0,
      };
    }

    return {
      successful: metrics.successfulInferences,
      failed: metrics.failedInferences,
      successPercentage: (metrics.successfulInferences / metrics.totalAttempts) * 100,
      failurePercentage: (metrics.failedInferences / metrics.totalAttempts) * 100,
    };
  });

  constructor() {
    merge(of(void 0), timer(30_000, 30_000), this.manualRefresh$)
      .pipe(
        exhaustMap(() => {
          if (!this.monitoring()) {
            this.loading.set(true);
          }

          this.error.set(null);

          return this.monitoringService.getOverview(this.selectedRange()).pipe(
            tap((response) => {
              this.monitoring.set(response.data);
              this.lastUpdated.set(new Date());
            }),
            catchError((error: unknown) => {
              console.error('Failed to load monitoring data:', error);

              this.error.set(
                'Unable to refresh monitoring data. Please check the API connection and try again.',
              );

              return EMPTY;
            }),
            finalize(() => {
              this.loading.set(false);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected loadMonitoring(): void {
    this.manualRefresh$.next();
  }

  protected changeRange(range: MonitoringRange): void {
    if (this.selectedRange() === range) {
      return;
    }

    this.selectedRange.set(range);
    this.manualRefresh$.next();
  }

  protected formatUptime(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds)) {
      return '—';
    }

    const totalSeconds = Math.max(0, Math.floor(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
  }

  protected formatLatency(value: number | null | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} ms`;
  }

  protected formatPercentage(value: number | null | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
  }
}
