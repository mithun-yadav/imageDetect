import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { DetectionResponse } from '../../shared/models/detection.model';
import {
  DetectionHistoryQuery,
  DetectionHistoryResponse,
  DetectionDetailResponse,
} from '../../shared/models/detection-history.model';

@Injectable({
  providedIn: 'root',
})
export class DetectionService {
  private readonly http = inject(HttpClient);

  detectImage(file: File): Observable<DetectionResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<DetectionResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
      formData,
    );
  }

  getHistory(query: DetectionHistoryQuery = {}): Observable<DetectionHistoryResponse> {
    let params = new HttpParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<DetectionHistoryResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detections}`,
      { params },
    );
  }

  getDetails(id: string): Observable<DetectionDetailResponse> {
    return this.http.get<DetectionDetailResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detectionDetails}/${encodeURIComponent(id)}`,
    );
  }

  getOriginalImageUrl(id: string): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.detectionDetails}/${encodeURIComponent(id)}/image`;
  }
}
