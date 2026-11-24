import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiBaseUrl,
  endpoints: {
    health: '/health/ready',
    detections: '/detections',
    analyticsOverview: '/analytics/overview',
    detectionDetails: '/detections',
    detectionAnalytics: '/analytics/overview',
  },
} as const;
