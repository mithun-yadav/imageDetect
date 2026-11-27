import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { AnalyticsOverviewResponse } from '../../shared/models/analytics.model';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<AnalyticsOverviewResponse> {
    return this.http.get<AnalyticsOverviewResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyticsOverview}`,
    );
  }
}
