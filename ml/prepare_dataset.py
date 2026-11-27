
from pathlib import Path
import shutil
import zipfile

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ZIP_PATH = PROJECT_ROOT / "manual-detected-yolo-more-corrected2.zip"
SOURCE_IMAGE = PROJECT_ROOT / "data/images/test.png"

DATASET_DIR = PROJECT_ROOT / "data/dataset"
IMAGE_DIR = DATASET_DIR / "images/val"
LABEL_DIR = DATASET_DIR / "labels/val"

ANNOTATION_PATH_IN_ZIP = "obj_train_data/test.txt"

CLASS_NAMES = ["person", "car", "bicycle", "dog"]


def main():
    if not ZIP_PATH.exists():
        raise FileNotFoundError(f"ZIP not found: {ZIP_PATH}")

    if not SOURCE_IMAGE.exists():
        raise FileNotFoundError(f"Image not found: {SOURCE_IMAGE}")

    with zipfile.ZipFile(ZIP_PATH, "r") as archive:
        if ANNOTATION_PATH_IN_ZIP not in archive.namelist():
            raise FileNotFoundError("Annotation file missing from ZIP")

        annotation_text = archive.read(
            ANNOTATION_PATH_IN_ZIP
        ).decode("utf-8")

    lines = [
        line.strip()
        for line in annotation_text.splitlines()
        if line.strip()
    ]

    class_counts = {i: 0 for i in range(len(CLASS_NAMES))}

    for line_number, line in enumerate(lines, start=1):
        values = line.split()

        if len(values) != 5:
            raise ValueError(f"Invalid annotation at line {line_number}")

        class_id = int(values[0])

        if class_id not in class_counts:
            raise ValueError(f"Invalid class ID at line {line_number}")

        coordinates = [float(value) for value in values[1:]]

        if not all(0 <= value <= 1 for value in coordinates):
            raise ValueError(
                f"Coordinates outside [0, 1] at line {line_number}"
            )

        class_counts[class_id] += 1

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    LABEL_DIR.mkdir(parents=True, exist_ok=True)

    shutil.copy2(
        SOURCE_IMAGE,
        IMAGE_DIR / "test.png"
    )

    (LABEL_DIR / "test.txt").write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8"
    )

    yaml_content = """path: .
val: images/val

names:
  0: person
  1: car
  2: bicycle
  3: dog
"""

    (DATASET_DIR / "data.yaml").write_text(
        yaml_content,
        encoding="utf-8"
    )

    print("\nDataset prepared successfully!")
    print("Total annotations:", len(lines))

    for class_id, count in class_counts.items():
        print(f"{CLASS_NAMES[class_id]}: {count}")

    print("\nDataset location:", DATASET_DIR)


if __name__ == "__main__":
    main()
