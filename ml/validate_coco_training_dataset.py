
import json
import math
from collections import Counter
from pathlib import Path

import yaml
from PIL import Image
from annotation_exclusions import EXCLUDED_ANNOTATIONS

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATASET_DIR = (
    PROJECT_ROOT / "data/training/coco2017-four-class"
)

MANIFEST_PATH = (
    PROJECT_ROOT / "data/public/coco2017/selection_manifest.json"
)

EXPECTED_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "dog",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
SPLITS = ("train", "val")


def validate_yaml(errors):
    yaml_path = DATASET_DIR / "data.yaml"

    if not yaml_path.is_file():
        errors.append("Missing data.yaml")
        return

    try:
        with yaml_path.open("r", encoding="utf-8") as file:
            config = yaml.safe_load(file)

        expected_names = EXPECTED_CLASSES

        if config.get("names") != expected_names:
            errors.append(
                f"Incorrect class names or mapping: {config.get('names')}"
            )

        if Path(config.get("path", "")).resolve() != DATASET_DIR.resolve():
            errors.append("Incorrect dataset root in data.yaml")

        for split in SPLITS:
            split_path = DATASET_DIR / config[split]

            if not split_path.is_dir():
                errors.append(
                    f"Invalid {split} path in data.yaml: {split_path}"
                )

    except Exception as error:
        errors.append(f"Invalid data.yaml: {error}")


def validate_split(split, errors):
    image_dir = DATASET_DIR / "images" / split
    label_dir = DATASET_DIR / "labels" / split

    if not image_dir.is_dir() or not label_dir.is_dir():
        errors.append(f"Missing image or label directory: {split}")
        return set(), Counter()

    images = {
        path.stem: path
        for path in image_dir.iterdir()
        if path.is_file()
        and path.suffix.lower() in IMAGE_EXTENSIONS
    }

    labels = {
        path.stem: path
        for path in label_dir.glob("*.txt")
        if path.is_file()
    }

    image_stems = set(images)
    label_stems = set(labels)

    missing_labels = image_stems - label_stems
    orphan_labels = label_stems - image_stems

    for stem in sorted(missing_labels):
        errors.append(f"{split}: Missing label for {stem}")

    for stem in sorted(orphan_labels):
        errors.append(f"{split}: Orphan label for {stem}")

    class_counts = Counter()
    valid_images = 0
    valid_boxes = 0
    empty_labels = 0

    for stem, image_path in images.items():
        label_path = labels.get(stem)

        try:
            with Image.open(image_path) as image:
                image.verify()

            with Image.open(image_path) as image:
                image_width, image_height = image.size

                if image_width <= 0 or image_height <= 0:
                    raise ValueError("Invalid image dimensions")

            valid_images += 1

        except Exception as error:
            errors.append(
                f"{split}: Invalid image {image_path.name}: {error}"
            )
            continue

        if label_path is None:
            continue

        lines = label_path.read_text(
            encoding="utf-8"
        ).splitlines()

        valid_label_lines = [
            line for line in lines if line.strip()
        ]

        if not valid_label_lines:
            empty_labels += 1

        for line_number, line in enumerate(lines, start=1):
            if not line.strip():
                continue

            parts = line.split()

            if len(parts) != 5:
                errors.append(
                    f"{split}: Invalid format "
                    f"{label_path.name}:{line_number}"
                )
                continue

            try:
                class_id = int(parts[0])
                x_center, y_center, width, height = map(
                    float, parts[1:]
                )
            except ValueError:
                errors.append(
                    f"{split}: Non-numeric annotation "
                    f"{label_path.name}:{line_number}"
                )
                continue

            if class_id not in EXPECTED_CLASSES:
                errors.append(
                    f"{split}: Invalid class ID {class_id} "
                    f"in {label_path.name}:{line_number}"
                )
                continue

            values = [x_center, y_center, width, height]

            if not all(math.isfinite(value) for value in values):
                errors.append(
                    f"{split}: Non-finite coordinates "
                    f"{label_path.name}:{line_number}"
                )
                continue

            valid_box = (
                0 <= x_center <= 1
                and 0 <= y_center <= 1
                and 0 < width <= 1
                and 0 < height <= 1
                and x_center - width / 2 >= -1e-6
                and y_center - height / 2 >= -1e-6
                and x_center + width / 2 <= 1 + 1e-6
                and y_center + height / 2 <= 1 + 1e-6
            )

            if not valid_box:
                errors.append(
                    f"{split}: Bounding box outside image "
                    f"{label_path.name}:{line_number}"
                )
                continue

            class_counts[class_id] += 1
            valid_boxes += 1

    print(f"\n{split.upper()} VALIDATION")
    print("=" * 60)
    print(f"Images found: {len(images)}")
    print(f"Labels found: {len(labels)}")
    print(f"Valid images: {valid_images}")
    print(f"Valid bounding boxes: {valid_boxes}")
    print(f"Empty label files: {empty_labels}")
    print(f"Missing labels: {len(missing_labels)}")
    print(f"Orphan labels: {len(orphan_labels)}")

    return image_stems, class_counts


def main():
    errors = []

    print("COCO FOUR-CLASS DATASET VALIDATION")
    print("=" * 60)

    if not DATASET_DIR.is_dir():
        raise FileNotFoundError(DATASET_DIR)

    validate_yaml(errors)

    train_images, train_counts = validate_split(
        "train", errors
    )

    val_images, val_counts = validate_split(
        "val", errors
    )

    overlap = train_images & val_images

    if overlap:
        errors.append(
            f"Train/validation leakage: {sorted(overlap)}"
        )

    print("\nSPLIT CHECK")
    print("=" * 60)
    print(f"Training images: {len(train_images)}")
    print(f"Validation images: {len(val_images)}")
    print(f"Overlapping images: {len(overlap)}")

    validate_manifest_totals(
        train_counts,
        val_counts,
        errors,
    )

    

def validate_manifest_totals(train_counts, val_counts, errors):
    if not MANIFEST_PATH.is_file():
        errors.append("Missing selection manifest")
        return

    with MANIFEST_PATH.open("r", encoding="utf-8") as file:
        manifest = json.load(file)

    expected = manifest["selected_class_totals"].copy()

    annotation_path = (
        PROJECT_ROOT
        / "data/public/coco2017/annotations/instances_train2017.json"
    )

    if not annotation_path.is_file():
        errors.append("Missing COCO source annotations")
        return

    with annotation_path.open("r", encoding="utf-8") as file:
        coco = json.load(file)

    annotations_by_id = {
        annotation["id"]: annotation
        for annotation in coco["annotations"]
    }

    coco_to_yolo = {
        1: 0,
        2: 1,
        3: 2,
        18: 3,
    }

    for annotation_id, exclusion in EXCLUDED_ANNOTATIONS.items():
        annotation = annotations_by_id.get(annotation_id)

        if annotation is None:
            errors.append(
                f"Excluded annotation {annotation_id} not found"
            )
            continue

        if (
            annotation["image_id"] != exclusion["image_id"]
            or annotation["category_id"] != exclusion["category_id"]
        ):
            errors.append(
                f"Exclusion metadata mismatch: {annotation_id}"
            )
            continue

        if annotation.get("iscrowd", 0):
            errors.append(
                f"Excluded annotation {annotation_id} is a crowd annotation"
            )
            continue

        category_id = exclusion["category_id"]
        yolo_class_id = coco_to_yolo.get(category_id)

        if yolo_class_id is None:
            errors.append(
                f"Unsupported exclusion category: {category_id}"
            )
            continue

        class_name = EXPECTED_CLASSES[yolo_class_id]

        if class_name not in expected or expected[class_name] <= 0:
            errors.append(
                f"Invalid expected count for exclusion: {annotation_id}"
            )
            continue

        expected[class_name] -= 1

        print(
            f"Documented exclusion: annotation {annotation_id} "
            f"({class_name})"
        )

    print("\nMANIFEST CLASS COUNT COMPARISON")
    print("=" * 60)

    for class_id, class_name in EXPECTED_CLASSES.items():
        actual = train_counts[class_id] + val_counts[class_id]
        expected_count = expected[class_name]

        print(
            f"{class_name:<12}"
            f"Expected: {expected_count:>5}"
            f" Actual: {actual:>5}"
        )

        if actual != expected_count:
            errors.append(
                f"{class_name}: expected {expected_count}, "
                f"found {actual}"
            )


    print("\nCLASS DISTRIBUTION")
    print("=" * 60)

    for class_id, class_name in EXPECTED_CLASSES.items():
        print(
            f"{class_name:<12}"
            f"Train: {train_counts[class_id]:>5}"
            f" Val: {val_counts[class_id]:>5}"
        )

    print("\nFINAL RESULT")
    print("=" * 60)

    if errors:
        print(f"VALIDATION FAILED: {len(errors)} errors")

        for error in errors:
            print("ERROR:", error)

        raise SystemExit(1)

    print("DATASET VALIDATION PASSED")


if __name__ == "__main__":
    main()
