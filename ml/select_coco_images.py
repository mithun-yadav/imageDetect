
import json
import math
import random
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ANNOTATION_PATH = (
    PROJECT_ROOT
    / "data/public/coco2017/annotations/instances_train2017.json"
)

COCO128_IMAGE_DIR = (
    PROJECT_ROOT / "data/public/coco128/images/train2017"
)

MANIFEST_PATH = (
    PROJECT_ROOT
    / "data/public/coco2017/selection_manifest.json"
)

# COCO category IDs, not YOLO IDs.
TARGET_CLASSES = {
    1: "person",
    2: "bicycle",
    3: "car",
    18: "dog",
}

# Final YOLO class IDs.
YOLO_CLASS_MAPPING = {
    1: 0,
    2: 1,
    3: 2,
    18: 3,
}

SIZE_TARGETS = {
    "person": {"small": 180, "medium": 135, "large": 135},
    "bicycle": {"small": 70, "medium": 95, "large": 110},
    "car": {"small": 140, "medium": 105, "large": 105},
    "dog": {"small": 55, "medium": 82, "large": 138},
}

MAX_IMAGES = 500
RANDOM_SEED = 42

SIZES = ("small", "medium", "large")


def classify_size(bbox, image_width, image_height):
    _, _, width, height = bbox
    area_ratio = (width * height) / (image_width * image_height)

    if area_ratio < 0.01:
        return "small"

    if area_ratio <= 0.05:
        return "medium"

    return "large"


def load_existing_image_ids():
    existing_ids = set()

    if not COCO128_IMAGE_DIR.exists():
        raise FileNotFoundError(COCO128_IMAGE_DIR)

    for image_path in COCO128_IMAGE_DIR.iterdir():
        if image_path.is_file():
            try:
                existing_ids.add(int(image_path.stem))
            except ValueError:
                continue

    return existing_ids


def load_candidates():
    if not ANNOTATION_PATH.exists():
        raise FileNotFoundError(ANNOTATION_PATH)

    with ANNOTATION_PATH.open("r", encoding="utf-8") as file:
        dataset = json.load(file)

    images = {
        image["id"]: image
        for image in dataset["images"]
    }

    candidates = defaultdict(
        lambda: {
            "counts": Counter(),
            "annotations": [],
        }
    )

    invalid_counts = Counter()
    crowd_counts = Counter()

    for annotation in dataset["annotations"]:
        category_id = annotation["category_id"]

        if category_id not in TARGET_CLASSES:
            continue

        class_name = TARGET_CLASSES[category_id]
        image_id = annotation["image_id"]

        if annotation.get("iscrowd", 0):
            crowd_counts[class_name] += 1
            continue

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
            invalid_counts[class_name] += 1
            continue

        image = images.get(image_id)

        if image is None:
            raise ValueError(
                f"Missing image metadata: {image_id}"
            )

        width = image["width"]
        height = image["height"]

        if width <= 0 or height <= 0:
            raise ValueError(
                f"Invalid image dimensions: {image_id}"
            )

        size = classify_size(bbox, width, height)

        candidates[image_id]["counts"][(class_name, size)] += 1
        candidates[image_id]["annotations"].append(annotation)

    return images, candidates, invalid_counts, crowd_counts


def select_images(images, candidates, excluded_ids):
    remaining = {
        class_name: dict(size_targets)
        for class_name, size_targets in SIZE_TARGETS.items()
    }

    rng = random.Random(RANDOM_SEED)

    eligible_ids = [
        image_id
        for image_id in candidates
        if image_id not in excluded_ids
    ]

    # Random tie-breakers are generated once for reproducibility.
    tie_breakers = {
        image_id: rng.random()
        for image_id in eligible_ids
    }

    selected_ids = []

    while len(selected_ids) < MAX_IMAGES:
        best_id = None
        best_score = 0
        best_tie_breaker = -1

        for image_id in eligible_ids:
            if image_id in selected_ids:
                continue

            counts = candidates[image_id]["counts"]
            score = 0

            for class_name in SIZE_TARGETS:
                for size in SIZES:
                    target = SIZE_TARGETS[class_name][size]
                    deficit = remaining[class_name][size]

                    if deficit <= 0:
                        continue

                    contribution = min(
                        counts[(class_name, size)],
                        deficit,
                    )

                    score += contribution / target

            tie_breaker = tie_breakers[image_id]

            if (
                score > best_score
                or (
                    score == best_score
                    and score > 0
                    and tie_breaker > best_tie_breaker
                )
            ):
                best_id = image_id
                best_score = score
                best_tie_breaker = tie_breaker

        if best_id is None or best_score <= 0:
            break

        selected_ids.append(best_id)

        counts = candidates[best_id]["counts"]

        for class_name in SIZE_TARGETS:
            for size in SIZES:
                contribution = counts[(class_name, size)]

                remaining[class_name][size] = max(
                    0,
                    remaining[class_name][size] - contribution,
                )

    return selected_ids, remaining


def main():
    print("Loading COCO candidates...")

    images, candidates, invalid_counts, crowd_counts = (
        load_candidates()
    )

    excluded_ids = load_existing_image_ids()

    print(f"Candidate images: {len(candidates):,}")
    print(f"COCO128 images excluded: {len(excluded_ids):,}")

    selected_ids, remaining = select_images(
        images,
        candidates,
        excluded_ids,
    )

    selected_records = []
    class_totals = Counter()
    size_totals = defaultdict(Counter)

    for image_id in selected_ids:
        image = images[image_id]
        counts = candidates[image_id]["counts"]

        class_counts = Counter()
        object_sizes = {}

        for (class_name, size), count in counts.items():
            class_counts[class_name] += count
            size_totals[class_name][size] += count

        for class_name in TARGET_CLASSES.values():
            class_totals[class_name] += class_counts[class_name]

            object_sizes[class_name] = {
                size: counts[(class_name, size)]
                for size in SIZES
            }

        selected_records.append({
            "image_id": image_id,
            "file_name": image["file_name"],
            "width": image["width"],
            "height": image["height"],
            "coco_url": image["coco_url"],
            "class_counts": dict(class_counts),
            "object_sizes": object_sizes,
        })

    manifest = {
        "source": "COCO 2017 train",
        "random_seed": RANDOM_SEED,
        "max_images": MAX_IMAGES,
        "selected_image_count": len(selected_records),
        "excluded_coco128_image_count": len(excluded_ids),
        "target_classes": TARGET_CLASSES,
        "yolo_class_mapping": YOLO_CLASS_MAPPING,
        "size_targets": SIZE_TARGETS,
        "selected_class_totals": dict(class_totals),
        "selected_size_totals": {
            class_name: dict(size_totals[class_name])
            for class_name in TARGET_CLASSES.values()
        },
        "remaining_targets": remaining,
        "invalid_annotations_skipped": dict(invalid_counts),
        "crowd_annotations_skipped": dict(crowd_counts),
        "images": selected_records,
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    with MANIFEST_PATH.open("w", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)

    print("\nCOCO IMAGE SELECTION COMPLETE")
    print("=" * 65)

    print(f"Selected images: {len(selected_records)}")

    print("\nSELECTED CLASS INSTANCES")
    print("-" * 65)

    for class_name in TARGET_CLASSES.values():
        print(
            f"{class_name:<12}"
            f"Instances: {class_totals[class_name]:>6}"
        )

    print("\nSELECTED OBJECT SIZES")
    print("-" * 65)

    for class_name in TARGET_CLASSES.values():
        print(
            f"{class_name:<12}"
            + "  ".join(
                f"{size}: {size_totals[class_name][size]}"
                for size in SIZES
            )
        )

    print("\nREMAINING TARGETS")
    print("-" * 65)

    for class_name, size_targets in remaining.items():
        print(f"\n{class_name}")

        for size, count in size_targets.items():
            print(f"  {size}: {count}")

    print("\nINVALID ANNOTATIONS:", sum(invalid_counts.values()))
    print("CROWD ANNOTATIONS:", sum(crowd_counts.values()))

    print(f"\nManifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
