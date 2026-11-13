import math
import json
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ANNOTATION_PATH = (
    PROJECT_ROOT
    / "data/public/coco2017/annotations/instances_train2017.json"
)

# COCO JSON category IDs, not YOLO label IDs.
TARGET_CLASSES = {
    1: "person",
    2: "bicycle",
    3: "car",
    18: "dog",
}

# Project-specific thresholds, consistent with our earlier analysis.
SMALL_THRESHOLD = 0.01
MEDIUM_THRESHOLD = 0.05


def classify_object_size(bbox, image_width, image_height):
    _, _, width, height = bbox

    area_ratio = (
        width * height
    ) / (image_width * image_height)

    if area_ratio < SMALL_THRESHOLD:
        return "small"

    if area_ratio <= MEDIUM_THRESHOLD:
        return "medium"

    return "large"


def main():
    if not ANNOTATION_PATH.exists():
        raise FileNotFoundError(ANNOTATION_PATH)

    print("Loading COCO annotations...")

    with ANNOTATION_PATH.open("r", encoding="utf-8") as file:
        dataset = json.load(file)

    images = {
        image["id"]: image
        for image in dataset["images"]
    }

    target_image_ids = set()

    image_class_counts = defaultdict(Counter)
    instance_counts = Counter()
    size_counts = defaultdict(Counter)
    crowd_counts = Counter()
    invalid_annotation_counts = Counter()
    invalid_annotation_examples = []

    total_target_annotations = 0

    for annotation in dataset["annotations"]:
        category_id = annotation["category_id"]

        if category_id not in TARGET_CLASSES:
            continue

        class_name = TARGET_CLASSES[category_id]
        image_id = annotation["image_id"]

        if image_id not in images:
            raise ValueError(
                f"Annotation references missing image: {image_id}"
            )

        if annotation.get("iscrowd", 0):
            crowd_counts[class_name] += 1
            continue

        image = images[image_id]

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
            invalid_annotation_counts[class_name] += 1

            if len(invalid_annotation_examples) < 10:
                invalid_annotation_examples.append({
                    "annotation_id": annotation["id"],
                    "image_id": image_id,
                    "class": class_name,
                    "bbox": bbox,
                })

            continue

        image_width = image["width"]
        image_height = image["height"]

        if image_width <= 0 or image_height <= 0:
            raise ValueError(f"Invalid image dimensions: {image_id}")

        target_image_ids.add(image_id)

        instance_counts[class_name] += 1
        image_class_counts[image_id][class_name] += 1

        size = classify_object_size(
            bbox,
            image_width,
            image_height,
        )

        size_counts[class_name][size] += 1
        total_target_annotations += 1

    images_per_class = {
        class_name: sum(
            1
            for counts in image_class_counts.values()
            if counts[class_name] > 0
        )
        for class_name in TARGET_CLASSES.values()
    }

    combination_counts = Counter()

    for counts in image_class_counts.values():
        combination = tuple(
            class_name
            for class_name in TARGET_CLASSES.values()
            if counts[class_name] > 0
        )

        combination_counts[combination] += 1

    print("\nCOCO 2017 TRAINING DATASET ANALYSIS")
    print("=" * 75)

    print(f"Total images: {len(images):,}")
    print(f"Total annotations: {len(dataset['annotations']):,}")
    print(f"Images containing target classes: {len(target_image_ids):,}")
    print(
        f"Images without target classes: "
        f"{len(images) - len(target_image_ids):,}"
    )
    print(f"Target instances (excluding crowd): {total_target_annotations:,}")

    print("\nCLASS DISTRIBUTION")
    print("-" * 75)

    for class_name in TARGET_CLASSES.values():
        print(
            f"{class_name:<12}"
            f"Instances: {instance_counts[class_name]:>8,}  "
            f"Images: {images_per_class[class_name]:>8,}  "
            f"Crowd: {crowd_counts[class_name]:>6,}"
        )

    print("\nOBJECT SIZE DISTRIBUTION")
    print("-" * 75)

    for class_name in TARGET_CLASSES.values():
        sizes = size_counts[class_name]

        print(
            f"{class_name:<12}"
            f"Small: {sizes['small']:>7,}  "
            f"Medium: {sizes['medium']:>7,}  "
            f"Large: {sizes['large']:>7,}"
        )

    print("\nIMAGE CLASS COMBINATIONS")
    print("-" * 75)

    for combination, count in combination_counts.most_common():
        print(
            f"{' + '.join(combination):<40} {count:>8,} images"
        )

    print("\nCANDIDATE IMAGE COUNTS")
    print("-" * 75)

    for class_name in TARGET_CLASSES.values():
        candidate_ids = [
            image_id
            for image_id, counts in image_class_counts.items()
            if counts[class_name] > 0
        ]

        print(f"{class_name:<12}: {len(candidate_ids):,} images")


    print("\nINVALID ANNOTATIONS")
    print("-" * 75)

    total_invalid = sum(invalid_annotation_counts.values())

    print(f"Total invalid annotations skipped: {total_invalid}")

    for class_name in TARGET_CLASSES.values():
        print(
            f"{class_name:<12}: "
            f"{invalid_annotation_counts[class_name]}"
        )

    if invalid_annotation_examples:
        print("\nFirst invalid annotation examples:")

        for example in invalid_annotation_examples:
            print(example)


    print("\nANALYSIS COMPLETE")


if __name__ == "__main__":
    main()
