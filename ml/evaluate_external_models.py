
from collections import defaultdict
from pathlib import Path

from PIL import Image
from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent.parent

IMAGE_DIR = PROJECT_ROOT / "data/external-evaluation/images"
LABEL_DIR = PROJECT_ROOT / "data/external-evaluation/labels"

ORIGINAL_MODEL = PROJECT_ROOT / "yolo26n.pt"
TRAINED_MODEL = (
    PROJECT_ROOT / "runs/train/coco128-four-class/weights/best.pt"
)

CONFIDENCE_THRESHOLDS = [0.10, 0.25, 0.50]
IOU_THRESHOLD = 0.50
IMAGE_SIZE = 640

CLASS_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "dog",
}

# Original COCO class IDs -> external dataset IDs
ORIGINAL_CLASS_MAPPING = {
    0: 0,
    1: 1,
    2: 2,
    16: 3,
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


def load_ground_truth(image_paths):
    ground_truth = {}

    for image_path in image_paths:
        label_path = LABEL_DIR / f"{image_path.stem}.txt"

        if not label_path.exists():
            raise FileNotFoundError(
                f"Missing annotation file: {label_path}"
            )

        width, height = Image.open(image_path).size
        image_gt = defaultdict(list)

        for line_number, line in enumerate(
            label_path.read_text(encoding="utf-8").splitlines(),
            start=1,
        ):
            if not line.strip():
                continue

            values = list(map(float, line.split()))

            if len(values) != 5:
                raise ValueError(
                    f"Invalid annotation: {label_path}:{line_number}"
                )

            class_id = int(values[0])

            if class_id not in CLASS_NAMES:
                raise ValueError(
                    f"Unexpected class ID {class_id} in {label_path}"
                )

            _, cx, cy, w, h = values

            image_gt[class_id].append([
                (cx - w / 2) * width,
                (cy - h / 2) * height,
                (cx + w / 2) * width,
                (cy + h / 2) * height,
            ])

        ground_truth[image_path.name] = image_gt

    return ground_truth


def collect_predictions(model, image_paths, confidence, mapping):
    predictions = {}

    for image_path in image_paths:
        results = model.predict(
            source=str(image_path),
            conf=confidence,
            imgsz=IMAGE_SIZE,
            device="cpu",
            verbose=False,
        )

        image_predictions = defaultdict(list)

        for result in results:
            for box in result.boxes:
                original_class_id = int(box.cls.item())

                if original_class_id not in mapping:
                    continue

                class_id = mapping[original_class_id]

                image_predictions[class_id].append({
                    "box": box.xyxy[0].tolist(),
                    "confidence": float(box.conf.item()),
                })

        predictions[image_path.name] = image_predictions

    return predictions


def evaluate_predictions(predictions, ground_truth):
    class_results = {}

    for class_id, class_name in CLASS_NAMES.items():
        tp = fp = fn = 0
        total_gt = total_predictions = 0

        for image_name, image_gt in ground_truth.items():
            gt_boxes = image_gt[class_id]

            pred_boxes = sorted(
                predictions[image_name][class_id],
                key=lambda item: item["confidence"],
                reverse=True,
            )

            total_gt += len(gt_boxes)
            total_predictions += len(pred_boxes)

            matched_gt = set()

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

            fn += len(gt_boxes) - len(matched_gt)

        precision = tp / (tp + fp) if tp + fp else 0
        recall = tp / (tp + fn) if tp + fn else 0
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall else 0
        )

        class_results[class_id] = {
            "name": class_name,
            "gt": total_gt,
            "predictions": total_predictions,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }

    return class_results


def print_results(model_name, confidence, results):
    total_tp = sum(item["tp"] for item in results.values())
    total_fp = sum(item["fp"] for item in results.values())
    total_fn = sum(item["fn"] for item in results.values())

    precision = (
        total_tp / (total_tp + total_fp)
        if total_tp + total_fp else 0
    )

    recall = (
        total_tp / (total_tp + total_fn)
        if total_tp + total_fn else 0
    )

    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0
    )

    print(f"\n{model_name} | Confidence: {confidence}")
    print("-" * 90)
    print(
        f"{'Class':10} {'GT':>5} {'Pred':>6} {'TP':>5} "
        f"{'FP':>5} {'FN':>5} {'Precision':>11} "
        f"{'Recall':>9} {'F1':>9}"
    )

    for item in results.values():
        print(
            f"{item['name']:10} "
            f"{item['gt']:5} "
            f"{item['predictions']:6} "
            f"{item['tp']:5} "
            f"{item['fp']:5} "
            f"{item['fn']:5} "
            f"{item['precision']:11.4f} "
            f"{item['recall']:9.4f} "
            f"{item['f1']:9.4f}"
        )

    print("-" * 90)
    print(
        f"Overall: TP={total_tp}, FP={total_fp}, FN={total_fn}"
    )
    print(
        f"Precision={precision:.4f} | "
        f"Recall={recall:.4f} | F1={f1:.4f}"
    )


def main():
    image_paths = sorted(
        path for path in IMAGE_DIR.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )

    if not image_paths:
        raise RuntimeError("No evaluation images found.")

    ground_truth = load_ground_truth(image_paths)

    print(f"Evaluation images: {len(image_paths)}")
    print(f"Ground-truth annotations: {sum(len(boxes) for image in ground_truth.values() for boxes in image.values())}")
    print(f"IoU threshold: {IOU_THRESHOLD}")
    print(f"Image size: {IMAGE_SIZE}")

    models = [
        (
            "Original YOLO26n",
            ORIGINAL_MODEL,
            ORIGINAL_CLASS_MAPPING,
        ),
        (
            "Fine-tuned YOLO26n",
            TRAINED_MODEL,
            {0: 0, 1: 1, 2: 2, 3: 3},
        ),
    ]

    for model_name, model_path, mapping in models:
        model = YOLO(str(model_path))

        for confidence in CONFIDENCE_THRESHOLDS:
            predictions = collect_predictions(
                model,
                image_paths,
                confidence,
                mapping,
            )

            results = evaluate_predictions(
                predictions,
                ground_truth,
            )

            print_results(model_name, confidence, results)


if __name__ == "__main__":
    main()
