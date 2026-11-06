
import cv2
from ultralytics import YOLO

# Load pretrained model
model = YOLO("yolo26n.pt")

# Read original image
image_path = "data/images/test.png"
image = cv2.imread(image_path)

# Run object detection
results = model.predict(
    source=image_path,
    conf=0.75,
    device="cpu"
)

# Draw bounding boxes manually
for result in results:
    for box in result.boxes:

        # Object information
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = result.names[class_id]

        # Bounding box coordinates
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        # Draw rectangle
        cv2.rectangle(
            image,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        # Prepare label
        label = f"{class_name} {confidence:.2f}"

        # Draw label
        cv2.putText(
            image,
            label,
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

# Save annotated image
output_path = "runs/detect/manual-detection.png"

cv2.imwrite(output_path, image)

print(f"Detection image saved: {output_path}")
print("Total detections:", len(result.boxes))
