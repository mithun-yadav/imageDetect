
from pathlib import Path
import shutil

import yaml
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]

SOURCE_DATASET = PROJECT_ROOT / "data/dataset"
TARGET_DATASET = PROJECT_ROOT / "data/coco-evaluation"

SOURCE_LABEL_DIR = SOURCE_DATASET / "labels/val"
TARGET_LABEL_DIR = TARGET_DATASET / "labels/val"

SOURCE_IMAGE_DIR = SOURCE_DATASET / "images/val"
TARGET_IMAGE_DIR = TARGET_DATASET / "images/val"

CUSTOM_TO_COCO = {
    0: 0,   # person
    1: 2,   # car
    2: 1,   # bicycle
    3: 16,  # dog
}


def main():
    model = YOLO(str(PROJECT_ROOT / "yolo26n.pt"))

    SOURCE_LABEL_DIR.mkdir(parents=True, exist_ok=True)

    source_label = SOURCE_LABEL_DIR / "test.txt"

    if not source_label.exists():
        raise FileNotFoundError(f"Source labels missing: {source_label}")

    TARGET_LABEL_DIR.mkdir(parents=True, exist_ok=True)
    TARGET_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    converted_lines = []
    class_counts = {}

    lines = source_label.read_text(encoding="utf-8").splitlines()

    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue

        values = line.split()

        if len(values) != 5:
            raise ValueError(f"Invalid annotation at line {line_number}")

        custom_class_id = int(values[0])

        if custom_class_id not in CUSTOM_TO_COCO:
            raise ValueError(
                f"Unknown class ID at line {line_number}: {custom_class_id}"
            )

        coco_class_id = CUSTOM_TO_COCO[custom_class_id]

        converted_lines.append(
            " ".join([str(coco_class_id), *values[1:]])
        )

        class_counts[coco_class_id] = class_counts.get(coco_class_id, 0) + 1

    target_label = TARGET_LABEL_DIR / "test.txt"

    target_label.write_text(
        "\n".join(converted_lines) + "\n",
        encoding="utf-8"
    )

    shutil.copy2(
        SOURCE_IMAGE_DIR / "test.png",
        TARGET_IMAGE_DIR / "test.png"
    )

    # Use the exact class mapping stored in the pretrained model.
    data_yaml = {
    "path": str(TARGET_DATASET),
    "train": "images/val",
    "val": "images/val",
    "names": model.names,
    }

    with (TARGET_DATASET / "data.yaml").open("w", encoding="utf-8") as file:
        yaml.safe_dump(data_yaml, file, sort_keys=False)

    print("\nCOCO evaluation dataset prepared!")
    print("Total annotations:", len(converted_lines))

    for coco_id, count in sorted(class_counts.items()):
        print(f"{model.names[coco_id]} (COCO ID {coco_id}): {count}")

    print("\nDataset location:", TARGET_DATASET)


if __name__ == "__main__":
    main()
