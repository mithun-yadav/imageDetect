import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { HealthResponse } from '../../shared/models/health.model';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly http = inject(HttpClient);

  getReadiness(): Observable<HealthResponse | null> {
    return this.http
      .get<HealthResponse>(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.health}`,
      )
      .pipe(catchError(() => of(null)));
  }
}
