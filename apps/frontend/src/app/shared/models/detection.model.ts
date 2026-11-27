export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface DetectionResult {
  image_width: number;
  image_height: number;
  total_detections: number;
  detections: Detection[];
}

export interface DetectionResponse {
  success: boolean;
  filename: string;
  model: string;
  confidence_threshold: number;
  processing_time_ms: number;
  result: DetectionResult;
}
