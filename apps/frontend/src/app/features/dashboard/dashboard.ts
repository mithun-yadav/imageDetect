import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HealthService } from '../../core/services/health.service';
import { RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'cv-dashboard',
  standalone: true,
  imports: [RouterLink, UpperCasePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly healthService = inject(HealthService);

  protected readonly health = toSignal(this.healthService.getReadiness(), {
    initialValue: undefined,
  });

  protected readonly apiStatus = computed(() => {
    const response = this.health();

    if (response === undefined) return 'Checking';
    if (!response) return 'Unavailable';

    return response.status === 'ok' ? 'Online' : 'Degraded';
  });

  protected readonly inferenceStatus = computed(() => {
    const response = this.health();

    if (response === undefined) return 'Checking';
    if (!response) return 'Unavailable';

    return response.info.inference.status === 'up' ? 'Online' : 'Offline';
  });

  protected readonly modelStatus = computed(() => {
    const response = this.health();

    if (response === undefined) return 'Checking';
    if (!response) return 'Unknown';

    return response.info.inference.modelLoaded ? 'Loaded' : 'Not loaded';
  });

  protected readonly inferenceDevice = computed(() => this.health()?.info.inference.device ?? '—');

  protected readonly responseTime = computed(
    () => this.health()?.info.inference.responseTime ?? null,
  );
}
