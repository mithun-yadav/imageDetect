
import argparse
import json
import math
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from annotation_exclusions import EXCLUDED_ANNOTATIONS
from PIL import Image

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ANNOTATION_PATH = (
    PROJECT_ROOT
    / "data/public/coco2017/annotations/instances_train2017.json"
)

MANIFEST_PATH = (
    PROJECT_ROOT
    / "data/public/coco2017/selection_manifest.json"
)

SOURCE_IMAGE_DIR = (
    PROJECT_ROOT / "data/public/coco2017/images/train2017"
)

TARGET_DIR = (
    PROJECT_ROOT / "data/training/coco2017-four-class"
)

# COCO category ID -> YOLO class ID
CLASS_MAPPING = {
    1: 0,   # person
    2: 1,   # bicycle
    3: 2,   # car
    18: 3,  # dog
}

CLASS_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "dog",
}

TRAIN_RATIO = 0.80
RANDOM_SEED = 42
VALIDATION_RATIO = 1 - TRAIN_RATIO

IMAGE_EXTENSIONS = {".jpg", ".jpeg"}


def load_inputs():
    for path in (
        ANNOTATION_PATH,
        MANIFEST_PATH,
        SOURCE_IMAGE_DIR,
    ):
        if not path.exists():
            raise FileNotFoundError(path)

    with ANNOTATION_PATH.open("r", encoding="utf-8") as file:
        coco = json.load(file)

    with MANIFEST_PATH.open("r", encoding="utf-8") as file:
        manifest = json.load(file)

    return coco, manifest


def validate_manifest(manifest):
    records = manifest["images"]

    if len(records) != manifest["selected_image_count"]:
        raise ValueError("Manifest image count mismatch")

    image_ids = [record["image_id"] for record in records]
    filenames = [record["file_name"] for record in records]

    if len(image_ids) != len(set(image_ids)):
        raise ValueError("Duplicate image IDs in manifest")

    if len(filenames) != len(set(filenames)):
        raise ValueError("Duplicate filenames in manifest")

    for record in records:
        if Path(record["file_name"]).name != record["file_name"]:
            raise ValueError(
                f"Unsafe image filename: {record['file_name']}"
            )

        if Path(record["file_name"]).suffix.lower() not in IMAGE_EXTENSIONS:
            raise ValueError(
                f"Unsupported image format: {record['file_name']}"
            )

        if record["width"] <= 0 or record["height"] <= 0:
            raise ValueError(
                f"Invalid image dimensions: {record['file_name']}"
            )

    return records




def split_images(records):
    """Create a deterministic, class-aware image-level split."""
    rng = random.Random(RANDOM_SEED)

    validation_count = round(
        len(records) * VALIDATION_RATIO
    )

    if validation_count <= 0 or validation_count >= len(records):
        raise ValueError("Invalid train/validation split size")

    # Calculate class counts after documented exclusions.
    adjusted_counts = {}

    category_to_class = {
        1: "person",
        2: "bicycle",
        3: "car",
        18: "dog",
    }

    for record in records:
        counts = record["class_counts"].copy()

        for exclusion in EXCLUDED_ANNOTATIONS.values():
            if exclusion["image_id"] != record["image_id"]:
                continue

            category_id = exclusion["category_id"]
            class_name = category_to_class[category_id]

            if counts.get(class_name, 0) <= 0:
                raise ValueError(
                    f"Invalid exclusion count for image "
                    f"{record['image_id']}: {class_name}"
                )

            counts[class_name] -= 1

        adjusted_counts[record["image_id"]] = counts

    total_counts = Counter()

    for counts in adjusted_counts.values():
        total_counts.update(counts)

    validation_targets = {
        class_name: total * VALIDATION_RATIO
        for class_name, total in total_counts.items()
    }

    remaining = dict(validation_targets)

    tie_breakers = {
        record["image_id"]: rng.random()
        for record in records
    }

    selected_validation_ids = set()
    validation_records = []

    while len(validation_records) < validation_count:
        best_record = None
        best_score = -1
        best_tie_breaker = -1

        for record in records:
            image_id = record["image_id"]

            if image_id in selected_validation_ids:
                continue

            score = 0

            for class_name, target in validation_targets.items():
                deficit = remaining[class_name]

                if deficit <= 0 or target <= 0:
                    continue

                contribution = min(
                    adjusted_counts[image_id].get(class_name, 0),
                    deficit,
                )

                score += contribution / target

            tie_breaker = tie_breakers[image_id]

            if (
                best_record is None
                or score > best_score
                or (
                    score == best_score
                    and tie_breaker > best_tie_breaker
                )
            ):
                best_record = record
                best_score = score
                best_tie_breaker = tie_breaker

        if best_record is None:
            raise RuntimeError(
                "Unable to construct validation split"
            )

        validation_records.append(best_record)
        selected_validation_ids.add(best_record["image_id"])

        for class_name in validation_targets:
            remaining[class_name] = max(
                0,
                remaining[class_name]
                - adjusted_counts[best_record["image_id"]].get(
                    class_name, 0
                ),
            )

    train_records = [
        record
        for record in records
        if record["image_id"] not in selected_validation_ids
    ]

    return train_records, validation_records




def load_annotations(coco, records):
    selected_ids = {
        record["image_id"]
        for record in records
    }

    image_metadata = {
        image["id"]: image
        for image in coco["images"]
        if image["id"] in selected_ids
    }

    if set(image_metadata) != selected_ids:
        raise ValueError(
            "Some selected images are missing from COCO metadata"
        )

    annotations_by_image = defaultdict(list)

    invalid_counts = Counter()
    crowd_counts = Counter()
    excluded_count = Counter()
    excluded_ids = set()

    for annotation in coco["annotations"]:
        annotation_id = annotation["id"]

        exclusion = EXCLUDED_ANNOTATIONS.get(annotation_id)

        # Skip documented problematic annotations.
        if exclusion is not None:
            if (
                annotation["image_id"] != exclusion["image_id"]
                or annotation["category_id"] != exclusion["category_id"]
            ):
                raise ValueError(
                    f"Exclusion metadata mismatch: {annotation_id}"
                )

            if annotation_id in excluded_ids:
                raise ValueError(
                    f"Duplicate excluded annotation: {annotation_id}"
                )

            excluded_ids.add(annotation_id)
            excluded_count[annotation["category_id"]] += 1
            continue

        image_id = annotation["image_id"]

        if image_id not in selected_ids:
            continue

        category_id = annotation["category_id"]

        if category_id not in CLASS_MAPPING:
            continue

        yolo_class_id = CLASS_MAPPING[category_id]

        if annotation.get("iscrowd", 0):
            crowd_counts[yolo_class_id] += 1
            continue

        image = image_metadata[image_id]
        width = image["width"]
        height = image["height"]

        bbox = annotation.get("bbox")

        valid_bbox = (
            isinstance(bbox, list)
            and len(bbox) == 4
            and all(
                isinstance(value, (int, float))
                and math.isfinite(value)
                for value in bbox
            )
            and bbox[2] > 0
            and bbox[3] > 0
        )

        if not valid_bbox:
            invalid_counts[yolo_class_id] += 1
            continue

        x, y, box_width, box_height = bbox

        if (
            x < 0
            or y < 0
            or x + box_width > width + 1e-6
            or y + box_height > height + 1e-6
        ):
            invalid_counts[yolo_class_id] += 1
            continue

        center_x = (x + box_width / 2) / width
        center_y = (y + box_height / 2) / height
        normalized_width = box_width / width
        normalized_height = box_height / height

        values = [
            center_x,
            center_y,
            normalized_width,
            normalized_height,
        ]

        if not all(
            math.isfinite(value) and 0 <= value <= 1
            for value in values
        ):
            invalid_counts[yolo_class_id] += 1
            continue

        label_line = (
            f"{yolo_class_id} "
            + " ".join(f"{value:.8f}" for value in values)
        )

        annotations_by_image[image_id].append(label_line)

    # Verify exact annotation exclusions after processing all annotations.
    expected_excluded_ids = set(EXCLUDED_ANNOTATIONS)

    if excluded_ids != expected_excluded_ids:
        missing = expected_excluded_ids - excluded_ids
        unexpected = excluded_ids - expected_excluded_ids

        raise ValueError(
            f"Annotation exclusion mismatch. "
            f"Missing: {missing}, Unexpected: {unexpected}"
        )

    return (
        annotations_by_image,
        invalid_counts,
        crowd_counts,
        excluded_count,
    )




def write_split(split_name, records, annotations_by_image):
    image_output_dir = TARGET_DIR / "images" / split_name
    label_output_dir = TARGET_DIR / "labels" / split_name

    image_output_dir.mkdir(parents=True, exist_ok=True)
    label_output_dir.mkdir(parents=True, exist_ok=True)

    class_counts = Counter()
    empty_images = 0

    for record in records:
        filename = record["file_name"]
        image_id = record["image_id"]

        source_image = SOURCE_IMAGE_DIR / filename

        if not source_image.is_file():
            raise FileNotFoundError(source_image)

        destination_image = image_output_dir / filename

        shutil.copy2(source_image, destination_image)

        # Verify copied image dimensions against the manifest.
        with Image.open(destination_image) as image:
            if image.size != (record["width"], record["height"]):
                raise ValueError(
                    f"Image dimension mismatch: {filename}. "
                    f"Expected {(record['width'], record['height'])}, "
                    f"got {image.size}"
                )

        label_lines = annotations_by_image.get(image_id, [])

        label_path = (
            label_output_dir
            / f"{Path(filename).stem}.txt"
        )

        label_path.write_text(
            "\n".join(label_lines) + (
                "\n" if label_lines else ""
            ),
            encoding="utf-8",
        )

        if not label_lines:
            empty_images += 1

        for line in label_lines:
            class_id = int(line.split()[0])
            class_counts[class_id] += 1

    return class_counts, empty_images



def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace the existing generated dataset",
    )

    args = parser.parse_args()

    print("Loading COCO annotations and manifest...")

    coco, manifest = load_inputs()
    records = validate_manifest(manifest)

    print(f"Selected images: {len(records)}")

    train_records, validation_records = split_images(records)

    train_ids = {
        record["image_id"] for record in train_records
    }

    validation_ids = {
        record["image_id"] for record in validation_records
    }

    if train_ids & validation_ids:
        raise RuntimeError("Train/validation leakage detected")

    print(f"Training images: {len(train_records)}")
    print(f"Validation images: {len(validation_records)}")

    (
        annotations_by_image,
        invalid_counts,
        crowd_counts,
        excluded_count,
    ) = load_annotations(coco, records)

    # Check overwrite permission only after validating all inputs.
    if TARGET_DIR.exists():
        if not args.overwrite:
            raise FileExistsError(
                f"{TARGET_DIR} already exists. "
                "Inspect it first. Use --overwrite only "
                "if you intentionally want to replace it."
            )

        print(f"Removing existing generated dataset: {TARGET_DIR}")
        shutil.rmtree(TARGET_DIR)
    
    print("Documented annotations excluded:", sum(excluded_count.values()))

    train_counts, train_empty = write_split(
        "train",
        train_records,
        annotations_by_image,
    )

    val_counts, val_empty = write_split(
        "val",
        validation_records,
        annotations_by_image,
    )

    data_yaml = {
        "path": str(TARGET_DIR.resolve()),
        "train": "images/train",
        "val": "images/val",
        "names": CLASS_NAMES,
    }

    yaml_path = TARGET_DIR / "data.yaml"

    with yaml_path.open("w", encoding="utf-8") as file:
        yaml.safe_dump(
            data_yaml,
            file,
            sort_keys=False,
        )

    print("\nCOCO TO YOLO CONVERSION COMPLETE")
    print("=" * 70)

    print(f"Total images: {len(records)}")
    print(f"Training images: {len(train_records)}")
    print(f"Validation images: {len(validation_records)}")

    print("\nCLASS DISTRIBUTION")
    print("-" * 70)

    for class_id, class_name in CLASS_NAMES.items():
        print(
            f"{class_name:<12}"
            f"Train: {train_counts[class_id]:>5}  "
            f"Val: {val_counts[class_id]:>5}  "
            f"Total: {train_counts[class_id] + val_counts[class_id]:>5}"
        )

    print("\nDATA QUALITY")
    print("-" * 70)

    print("Invalid annotations skipped:", sum(invalid_counts.values()))
    print("Crowd annotations skipped:", sum(crowd_counts.values()))
    print("Training images without labels:", train_empty)
    print("Validation images without labels:", val_empty)

    print("\nTRAIN/VALIDATION OVERLAP:", len(train_ids & validation_ids))
    print("Dataset YAML:", yaml_path)
    print("Dataset directory:", TARGET_DIR)


if __name__ == "__main__":
    main()
