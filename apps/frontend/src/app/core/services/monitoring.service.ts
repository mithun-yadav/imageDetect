import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { MonitoringOverviewResponse } from '../../shared/models/monitoring.model';

@Injectable({
  providedIn: 'root',
})
export class MonitoringService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<MonitoringOverviewResponse> {
    return this.http.get<MonitoringOverviewResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
    );
  }
}
