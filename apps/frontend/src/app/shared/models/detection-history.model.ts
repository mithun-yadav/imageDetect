export interface DetectionHistoryItem {
  id: string;
  filename: string;
  model: string;
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  totalDetections: number;
  createdAt: string;
}

export interface DetectionHistoryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DetectionHistoryResponse {
  success: boolean;
  data: DetectionHistoryItem[];
  meta: DetectionHistoryMeta;
}

export interface DetectionHistoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  className?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DetectionDetailItem {
  id: string;
  classId: number;
  className: string;
  confidence: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface DetectionDetail {
  id: string;
  filename: string;
  model: string;
  confidenceThreshold: number;
  processingTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  totalDetections: number;
  detections: DetectionDetailItem[];
  createdAt: string;
}

export interface DetectionDetailResponse {
  success: boolean;
  data: DetectionDetail;
}
