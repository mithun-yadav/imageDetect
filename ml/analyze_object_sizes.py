
from pathlib import Path
from collections import defaultdict

from PIL import Image
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_PATH = PROJECT_ROOT / "data/coco-evaluation/images/val/test.png"
LABEL_PATH = PROJECT_ROOT / "data/coco-evaluation/labels/val/test.txt"
MODEL_PATH = PROJECT_ROOT / "yolo26n.pt"

CONFIDENCE_THRESHOLD = 0.10
IOU_THRESHOLD = 0.50

TARGET_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    16: "dog",
}


def calculate_iou(box_a, box_b):
    x1 = max(box_a[0], box_b[0])
    y1 = max(box_a[1], box_b[1])
    x2 = min(box_a[2], box_b[2])
    y2 = min(box_a[3], box_b[3])

    intersection = max(0, x2 - x1) * max(0, y2 - y1)

    area_a = max(0, box_a[2] - box_a[0]) * max(0, box_a[3] - box_a[1])
    area_b = max(0, box_b[2] - box_b[0]) * max(0, box_b[3] - box_b[1])

    union = area_a + area_b - intersection

    return intersection / union if union > 0 else 0


def classify_size(box, image_width, image_height):
    width = box[2] - box[0]
    height = box[3] - box[1]

    area_ratio = (width * height) / (image_width * image_height)

    if area_ratio < 0.01:
        return "small"

    if area_ratio <= 0.05:
        return "medium"

    return "large"


def load_ground_truth(image_width, image_height):
    ground_truth = []

    for line in LABEL_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue

        class_id, cx, cy, w, h = map(float, line.split())
        class_id = int(class_id)

        box = [
            (cx - w / 2) * image_width,
            (cy - h / 2) * image_height,
            (cx + w / 2) * image_width,
            (cy + h / 2) * image_height,
        ]

        ground_truth.append({
            "class_id": class_id,
            "box": box,
            "size": classify_size(box, image_width, image_height),
            "matched": False,
        })

    return ground_truth

print("Inference resolution:", 960)
def main():
    image_width, image_height = Image.open(IMAGE_PATH).size

    model = YOLO(str(MODEL_PATH))

    results = model.predict(
    source=str(IMAGE_PATH),
    conf=CONFIDENCE_THRESHOLD,
    classes=list(TARGET_CLASSES),
    imgsz=960,
    device="cpu",
    verbose=False,
)

    ground_truth = load_ground_truth(image_width, image_height)

    predictions = []

    for result in results:
        for detection in result.boxes:
            predictions.append({
                "class_id": int(detection.cls.item()),
                "box": detection.xyxy[0].tolist(),
                "confidence": float(detection.conf.item()),
            })

    predictions.sort(
        key=lambda prediction: prediction["confidence"],
        reverse=True,
    )

    # Match predictions with ground-truth objects.
    for prediction in predictions:
        best_match = None
        best_iou = 0

        for gt in ground_truth:
            if gt["matched"]:
                continue

            if gt["class_id"] != prediction["class_id"]:
                continue

            iou = calculate_iou(prediction["box"], gt["box"])

            if iou > best_iou:
                best_iou = iou
                best_match = gt

        if best_match is not None and best_iou >= IOU_THRESHOLD:
            best_match["matched"] = True

    # Aggregate results by class and object size.
    statistics = defaultdict(
        lambda: {"total": 0, "detected": 0, "missed": 0}
    )

    for gt in ground_truth:
        key = (gt["class_id"], gt["size"])

        statistics[key]["total"] += 1

        if gt["matched"]:
            statistics[key]["detected"] += 1
        else:
            statistics[key]["missed"] += 1

    print("\nCLASS-WISE OBJECT SIZE ANALYSIS")
    print(f"Confidence threshold: {CONFIDENCE_THRESHOLD}")
    print(f"IoU threshold: {IOU_THRESHOLD}")
    print("=" * 75)

    for class_id, class_name in TARGET_CLASSES.items():
        print(f"\n{class_name.upper()}")
        print("-" * 75)

        for size in ["small", "medium", "large"]:
            stats = statistics[(class_id, size)]

            total = stats["total"]
            detected = stats["detected"]
            missed = stats["missed"]

            recall = detected / total * 100 if total else 0

            print(
                f"{size.capitalize():<10} "
                f"Total: {total:<4} "
                f"Detected: {detected:<4} "
                f"Missed: {missed:<4} "
                f"Recall: {recall:.2f}%"
            )

        class_stats = [
            statistics[(class_id, size)]
            for size in ["small", "medium", "large"]
        ]

        total = sum(stats["total"] for stats in class_stats)
        detected = sum(stats["detected"] for stats in class_stats)
        recall = detected / total * 100 if total else 0

        print(f"Overall class recall: {recall:.2f}%")

    print("\nTOTAL GROUND-TRUTH OBJECTS:", len(ground_truth))
    print("TOTAL PREDICTIONS:", len(predictions))


if __name__ == "__main__":
    main()
