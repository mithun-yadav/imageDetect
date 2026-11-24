import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { AnalyticsService } from '../../core/services/analytics.service';
import { AnalyticsOverview } from '../../shared/models/analytics.model';

@Component({
  selector: 'cv-analytics',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class Analytics {
  private readonly analyticsService = inject(AnalyticsService);

  protected readonly analytics = signal<AnalyticsOverview | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadAnalytics();
  }

  protected loadAnalytics(): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsService.getOverview().subscribe({
      next: (response) => {
        this.analytics.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load analytics:', error);

        this.error.set('Unable to load analytics data. Please try again.');

        this.loading.set(false);
      },
    });
  }

  protected readonly activityChart = computed(() => {
    const activity = this.analytics()?.activity ?? [];

    const maxValue = Math.max(
      1,
      ...activity.flatMap((item) => [item.totalImages, item.totalObjects]),
    );

    return activity.map((item) => ({
      ...item,
      label: new Intl.DateTimeFormat('en', {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(new Date(`${item.date}T12:00:00Z`)),
      imageHeight: (item.totalImages / maxValue) * 100,
      objectHeight: (item.totalObjects / maxValue) * 100,
    }));
  });

  protected readonly classDistribution = computed(() => {
    const distribution = this.analytics()?.classDistribution ?? [];

    const total = distribution.reduce((sum, item) => sum + item.count, 0);

    return distribution.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  });

  protected readonly totalClassObjects = computed(() =>
    this.classDistribution().reduce((sum, item) => sum + item.count, 0),
  );
}
