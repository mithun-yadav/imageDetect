import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiBaseUrl,
  endpoints: {
    health: '/health/ready',
    detections: '/detections',
  },
} as const;
