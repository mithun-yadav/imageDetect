
from pathlib import Path
from collections import Counter

import cv2

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASET_DIR = PROJECT_ROOT / "data/dataset"

IMAGE_PATH = DATASET_DIR / "images/val/test.png"
LABEL_PATH = DATASET_DIR / "labels/val/test.txt"

CLASS_NAMES = {
    0: "person",
    1: "car",
    2: "bicycle",
    3: "dog",
}


def main():
    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(f"Cannot read image: {IMAGE_PATH}")

    height, width = image.shape[:2]

    print(f"Image dimensions: {width} x {height}")

    class_counts = Counter()
    errors = []

    with open(LABEL_PATH, encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]

    for line_number, line in enumerate(lines, start=1):
        values = line.split()

        if len(values) != 5:
            errors.append(f"Line {line_number}: Expected 5 values")
            continue

        try:
            class_id = int(values[0])
            x_center, y_center, box_width, box_height = map(
                float, values[1:]
            )
        except ValueError:
            errors.append(f"Line {line_number}: Invalid numeric value")
            continue

        if class_id not in CLASS_NAMES:
            errors.append(f"Line {line_number}: Invalid class ID")
            continue

        if not all(
            0 <= value <= 1
            for value in [x_center, y_center, box_width, box_height]
        ):
            errors.append(f"Line {line_number}: Coordinates outside [0, 1]")
            continue

        if box_width <= 0 or box_height <= 0:
            errors.append(f"Line {line_number}: Invalid box dimensions")
            continue

        x_min = x_center - box_width / 2
        y_min = y_center - box_height / 2
        x_max = x_center + box_width / 2
        y_max = y_center + box_height / 2

        if not (
            0 <= x_min < x_max <= 1
            and 0 <= y_min < y_max <= 1
        ):
            errors.append(f"Line {line_number}: Bounding box outside image")
            continue

        class_counts[class_id] += 1

    print(f"\nTotal annotation lines: {len(lines)}")

    print("\nClass distribution:")
    for class_id, name in CLASS_NAMES.items():
        print(f"{name}: {class_counts[class_id]}")

    print("\nValidation errors:")
    if errors:
        for error in errors:
            print("ERROR:", error)
    else:
        print("No structural or coordinate errors found.")

    print(f"\nValid annotations: {sum(class_counts.values())}/{len(lines)}")

    if errors:
        raise SystemExit("Dataset validation failed.")

    print("\nDataset validation passed!")


if __name__ == "__main__":
    main()
