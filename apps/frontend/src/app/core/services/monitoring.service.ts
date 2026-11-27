import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { MonitoringOverviewResponse, MonitoringRange } from '../../shared/models/monitoring.model';

@Injectable({
  providedIn: 'root',
})
export class MonitoringService {
  private readonly http = inject(HttpClient);

  getOverview(range: MonitoringRange = '24h'): Observable<MonitoringOverviewResponse> {
    const params = new HttpParams().set('range', range);

    return this.http.get<MonitoringOverviewResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.monitoringOverview}`,
      { params },
    );
  }
}
