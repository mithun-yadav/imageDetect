
from pathlib import Path
from collections import defaultdict

from PIL import Image
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_PATH = PROJECT_ROOT / "data/coco-evaluation/images/val/test.png"
LABEL_PATH = PROJECT_ROOT / "data/coco-evaluation/labels/val/test.txt"
MODEL_PATH = PROJECT_ROOT / "yolo26n.pt"

CONFIDENCE_THRESHOLDS = [0.10, 0.25, 0.50]
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


def load_ground_truth():
    width, height = Image.open(IMAGE_PATH).size

    ground_truth = defaultdict(list)

    for line in LABEL_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue

        class_id, cx, cy, w, h = map(float, line.split())
        class_id = int(class_id)

        x1 = (cx - w / 2) * width
        y1 = (cy - h / 2) * height
        x2 = (cx + w / 2) * width
        y2 = (cy + h / 2) * height

        ground_truth[class_id].append([x1, y1, x2, y2])

    return ground_truth


def evaluate_predictions(predictions, ground_truth):
    class_results = {}

    total_tp = 0
    total_fp = 0
    total_fn = 0

    for class_id, class_name in TARGET_CLASSES.items():
        gt_boxes = ground_truth[class_id]

        pred_boxes = sorted(
            predictions[class_id],
            key=lambda prediction: prediction["confidence"],
            reverse=True,
        )

        matched_gt = set()
        tp = 0
        fp = 0

        for prediction in pred_boxes:
            best_iou = 0
            best_gt_index = None

            for gt_index, gt_box in enumerate(gt_boxes):
                if gt_index in matched_gt:
                    continue

                iou = calculate_iou(prediction["box"], gt_box)

                if iou > best_iou:
                    best_iou = iou
                    best_gt_index = gt_index

            if best_gt_index is not None and best_iou >= IOU_THRESHOLD:
                tp += 1
                matched_gt.add(best_gt_index)
            else:
                fp += 1

        fn = len(gt_boxes) - len(matched_gt)

        class_results[class_id] = {
            "name": class_name,
            "ground_truth": len(gt_boxes),
            "predictions": len(pred_boxes),
            "tp": tp,
            "fp": fp,
            "fn": fn,
        }

        total_tp += tp
        total_fp += fp
        total_fn += fn

    return class_results, total_tp, total_fp, total_fn


def main():
    model = YOLO(str(MODEL_PATH))
    ground_truth = load_ground_truth()

    print("\nConfidence threshold comparison")
    print(f"IoU threshold: {IOU_THRESHOLD}")
    print("=" * 75)

    for confidence_threshold in CONFIDENCE_THRESHOLDS:

        results = model.predict(
            source=str(IMAGE_PATH),
            conf=confidence_threshold,
            classes=list(TARGET_CLASSES),
            device="cpu",
            verbose=False,
            imgsz=960,
        )

        predictions = defaultdict(list)

        for result in results:
            for box in result.boxes:
                class_id = int(box.cls.item())

                predictions[class_id].append({
                    "box": box.xyxy[0].tolist(),
                    "confidence": float(box.conf.item()),
                })

        class_results, total_tp, total_fp, total_fn = (
            evaluate_predictions(predictions, ground_truth)
        )

        print(f"\nCONFIDENCE THRESHOLD: {confidence_threshold}")
        print("-" * 75)

        for class_id, result in class_results.items():
            print(
                f"{result['name']:10} | "
                f"GT: {result['ground_truth']:2} | "
                f"Pred: {result['predictions']:2} | "
                f"TP: {result['tp']:2} | "
                f"FP: {result['fp']:2} | "
                f"FN: {result['fn']:2}"
            )

        precision = (
            total_tp / (total_tp + total_fp)
            if total_tp + total_fp > 0 else 0
        )

        recall = (
            total_tp / (total_tp + total_fn)
            if total_tp + total_fn > 0 else 0
        )

        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall > 0 else 0
        )

        print("-" * 75)
        print(f"Overall TP: {total_tp} | FP: {total_fp} | FN: {total_fn}")
        print(f"Precision: {precision:.4f}")
        print(f"Recall:    {recall:.4f}")
        print(f"F1 Score:  {f1:.4f}")


if __name__ == "__main__":
    main()
