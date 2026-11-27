
import os
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_MODEL_PATH = (
    PROJECT_ROOT
    / "runs"
    / "train"
    / "coco128-four-class"
    / "weights"
    / "best.pt"
)


class ObjectDetector:
    def __init__(self):
        self.model_path = Path(
            os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH))
        ).expanduser()

        self.confidence = float(
            os.getenv("CONFIDENCE_THRESHOLD", "0.25")
        )

        self.image_size = int(
            os.getenv("IMAGE_SIZE", "640")
        )

        self.device = os.getenv("DEVICE", "cpu")

        self.model = None

    def load_model(self):
        if not self.model_path.is_file():
            raise FileNotFoundError(
                f"Model checkpoint not found: {self.model_path}"
            )

        self.model = YOLO(str(self.model_path))

        print(f"YOLO model loaded: {self.model_path}")
        print(f"Classes: {self.model.names}")

    def predict(self, image: Image.Image):
        if self.model is None:
            raise RuntimeError("YOLO model is not initialized")

        image = image.convert("RGB")
        image_array = np.asarray(image)

        results = self.model.predict(
            source=image_array,
            imgsz=self.image_size,
            conf=self.confidence,
            device=self.device,
            verbose=False,
        )

        detections = []

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())

                x1, y1, x2, y2 = (
                    float(value)
                    for value in box.xyxy[0].tolist()
                )

                detections.append({
                    "class_id": class_id,
                    "class_name": result.names[class_id],
                    "confidence": confidence,
                    "bbox": {
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2,
                    },
                })

        return {
            "image_width": image.width,
            "image_height": image.height,
            "total_detections": len(detections),
            "detections": detections,
        }
