import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { DetectionResponse } from '../../shared/models/detection.model';

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
}
