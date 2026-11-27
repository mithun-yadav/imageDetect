
from pathlib import Path
from collections import Counter
import random
import shutil

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]

SOURCE_DIR = PROJECT_ROOT / "data/public/coco128"
TARGET_DIR = PROJECT_ROOT / "data/training/coco128-four-class"

SOURCE_IMAGE_DIR = SOURCE_DIR / "images/train2017"
SOURCE_LABEL_DIR = SOURCE_DIR / "labels/train2017"

CLASS_MAPPING = {
    0: 0,   # person
    1: 1,   # bicycle
    2: 2,   # car
    16: 3,  # dog
}

VERIFIED_NEGATIVE_IMAGE_IDS = {
    "000000000250",
    "000000000508",
}

CLASS_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "dog",
}

TRAIN_RATIO = 0.80
RANDOM_SEED = 42

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def filter_annotations(label_path):
    filtered_lines = []
    class_counts = Counter()

    if not label_path.exists():
        if label_path.stem in VERIFIED_NEGATIVE_IMAGE_IDS:
            return [], Counter()

        raise FileNotFoundError(
            f"Unexpected missing annotation: {label_path}"
        )

    for line_number, line in enumerate(
        label_path.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        if not line.strip():
            continue

        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                f"Invalid annotation at {label_path}, line {line_number}"
            )

        class_id = int(parts[0])

        if class_id not in CLASS_MAPPING:
            continue

        new_class_id = CLASS_MAPPING[class_id]

        # Preserve the original normalized bounding-box coordinates.
        filtered_line = " ".join(
            [str(new_class_id), *parts[1:]]
        )

        filtered_lines.append(filtered_line)
        class_counts[new_class_id] += 1

    return filtered_lines, class_counts


def main():
    if not SOURCE_IMAGE_DIR.exists():
        raise FileNotFoundError(SOURCE_IMAGE_DIR)

    if not SOURCE_LABEL_DIR.exists():
        raise FileNotFoundError(SOURCE_LABEL_DIR)

    images = sorted(
        path for path in SOURCE_IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )

    if not images:
        raise RuntimeError("No source images found.")

    # Shuffle images deterministically.
    random_generator = random.Random(RANDOM_SEED)
    random_generator.shuffle(images)

    train_count = int(len(images) * TRAIN_RATIO)

    train_images = images[:train_count]
    val_images = images[train_count:]

    splits = {
        "train": train_images,
        "val": val_images,
    }

    total_class_counts = Counter()
    split_class_counts = {
        "train": Counter(),
        "val": Counter(),
    }

    empty_images = 0

    for split_name, split_images in splits.items():
        image_output_dir = TARGET_DIR / "images" / split_name
        label_output_dir = TARGET_DIR / "labels" / split_name

        image_output_dir.mkdir(parents=True, exist_ok=True)
        label_output_dir.mkdir(parents=True, exist_ok=True)

        for image_path in split_images:
            label_path = SOURCE_LABEL_DIR / f"{image_path.stem}.txt"

            filtered_lines, class_counts = filter_annotations(label_path)

            # Copy the original image.
            shutil.copy2(
                image_path,
                image_output_dir / image_path.name,
            )

            # Write only the four target classes.
            output_label = label_output_dir / f"{image_path.stem}.txt"

            output_label.write_text(
                "\n".join(filtered_lines) + (
                    "\n" if filtered_lines else ""
                ),
                encoding="utf-8",
            )

            if not filtered_lines:
                empty_images += 1

            total_class_counts.update(class_counts)
            split_class_counts[split_name].update(class_counts)

    # Generate the YOLO dataset configuration.
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

    print("\nDATASET PREPARATION COMPLETE")
    print("=" * 65)

    print(f"Total images: {len(images)}")
    print(f"Training images: {len(train_images)}")
    print(f"Validation images: {len(val_images)}")
    print(f"Images without target classes: {empty_images}")

    print("\nCLASS DISTRIBUTION")
    print("-" * 65)

    for class_id, class_name in CLASS_NAMES.items():
        print(
            f"{class_name:<12} "
            f"Train: {split_class_counts['train'][class_id]:<5} "
            f"Val: {split_class_counts['val'][class_id]:<5} "
            f"Total: {total_class_counts[class_id]}"
        )

    print(f"\nDataset YAML: {yaml_path}")
    print(f"Dataset directory: {TARGET_DIR}")


if __name__ == "__main__":
    main()
