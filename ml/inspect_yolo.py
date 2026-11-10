import cv2
from ultralytics import YOLO
from ml.nms import non_max_suppression
from ultralytics import YOLO

model = YOLO("yolo26n.pt")

image_path = "data/images/test.png"

# Mode 1: Default one-to-many + NMS
normal_results = model.predict(
    source=image_path,
    conf=0.25,
    device="cpu",
    verbose=False
)

# Mode 2: One-to-one, NMS-free
nms_free_results = model.predict(
    source=image_path,
    conf=0.25,
    device="cpu",
    nms=False,
    verbose=False
)

print("Default mode:")
print("Detections:", len(normal_results[0].boxes))

print("\nNMS-free mode:")
print("Detections:", len(nms_free_results[0].boxes))

print("\nNMS-free detection data:")
print(nms_free_results[0].boxes.data[:5])


from ml.nms import non_max_suppression

# Get NMS-free YOLO detections
detections = nms_free_results[0].boxes.data.cpu().tolist()

# Extract boxes, confidence scores and class IDs
boxes = [d[:4] for d in detections]
scores = [d[4] for d in detections]
classes = [int(d[5]) for d in detections]

# Apply our custom class-aware NMS
selected_indices = non_max_suppression(
    boxes,
    scores,
    classes,
    iou_threshold=0.5
)

print("\nCustom NMS results:")
print("Before custom NMS:", len(boxes))
print("After custom NMS:", len(selected_indices))

for index in selected_indices:
    print({
        "class": nms_free_results[0].names[classes[index]],
        "confidence": round(scores[index], 3),
        "box": boxes[index]
    })

detections = nms_free_results[0].boxes.data.cpu().tolist()

boxes = [d[:4] for d in detections]
scores = [d[4] for d in detections]
classes = [int(d[5]) for d in detections]

if boxes:
    selected_indices = non_max_suppression(
        boxes,
        scores,
        classes,
        iou_threshold=0.5
    )
else:
    selected_indices = []

suppressed_indices = [
    i for i in range(len(boxes))
    if i not in selected_indices
]

print("\nSuppressed detections:")

for index in suppressed_indices:
    print({
        "class": nms_free_results[0].names[classes[index]],
        "confidence": round(scores[index], 3),
        "box": boxes[index]
    })

# Read original image
image = cv2.imread(image_path)

# Draw only detections that survived custom NMS
for index in selected_indices:

    x1, y1, x2, y2 = map(int, boxes[index])

    confidence = scores[index]
    class_id = classes[index]
    class_name = nms_free_results[0].names[class_id]

    # Draw bounding box
    cv2.rectangle(
        image,
        (x1, y1),
        (x2, y2),
        (0, 255, 0),
        2
    )

    # Draw label
    label = f"{class_name} {confidence:.2f}"

    cv2.putText(
        image,
        label,
        (x1, max(y1 - 10, 20)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 0),
        2
    )

# Save image
output_path = "runs/detect/custom-nms.png"

cv2.imwrite(output_path, image)

print(f"Custom NMS image saved: {output_path}")