
import cv2
from ultralytics import YOLO
from ml.nms import non_max_suppression


# Load YOLO model
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


# Extract NMS-free detections
detections = nms_free_results[0].boxes.data.cpu().tolist()

boxes = [d[:4] for d in detections]
scores = [d[4] for d in detections]
classes = [int(d[5]) for d in detections]


# Apply custom class-aware NMS
selected_indices = non_max_suppression(
    boxes,
    scores,
    classes,
    iou_threshold=0.5
)


# Identify suppressed detections
suppressed_indices = [
    i for i in range(len(boxes))
    if i not in selected_indices
]


print("\nCustom NMS results:")
print("Before custom NMS:", len(boxes))
print("After custom NMS:", len(selected_indices))
print("Suppressed:", len(suppressed_indices))


for index in suppressed_indices:
    print({
        "class": nms_free_results[0].names[classes[index]],
        "confidence": round(scores[index], 3),
        "box": boxes[index]
    })


# Draw detections on an image
def draw_detections(image, indices):

    for index in indices:

        x1, y1, x2, y2 = map(int, boxes[index])

        confidence = scores[index]
        class_id = classes[index]
        class_name = nms_free_results[0].names[class_id]

        cv2.rectangle(
            image,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

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

    return image


# Read original image once
original_image = cv2.imread(image_path)

if original_image is None:
    raise FileNotFoundError(f"Could not read image: {image_path}")


# Image 1: All NMS-free detections
all_indices = list(range(len(boxes)))

yolo_image = draw_detections(
    original_image.copy(),
    all_indices
)

cv2.imwrite(
    "runs/detect/yolo-nms-free.png",
    yolo_image
)


# Image 2: Custom NMS detections
custom_image = draw_detections(
    original_image.copy(),
    selected_indices
)

cv2.imwrite(
    "runs/detect/custom-nms.png",
    custom_image
)


print("\nVisualization completed!")
print("YOLO detections:", len(all_indices))
print("Custom NMS detections:", len(selected_indices))
