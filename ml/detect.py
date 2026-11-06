from ultralytics import YOLO

# Load pretrained YOLO model
model = YOLO("yolo26n.pt")

# Run object detection
results = model.predict(
    source="data/images/test.png",
    save=True,
    conf=0.25,
    device="cpu"
)

# Display detected objects
for result in results:
    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])

        class_name = result.names[class_id]

        # Extract bounding box coordinates
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        print(f"\nObject: {class_name}")
        print(f"Confidence: {confidence:.2f}")
        print(f"Bounding Box:")
        print(f"x1: {x1:.2f}, y1: {y1:.2f}")
        print(f"x2: {x2:.2f}, y2: {y2:.2f}")