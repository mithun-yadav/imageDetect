from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATASET_DIR = (
    PROJECT_ROOT
    / "data"
    / "training"
    / "coco128-four-class"
)

SPLITS = ["train", "val"]

VALID_CLASS_IDS = {0, 1, 2, 3}


def validate_split(split):
    image_dir = DATASET_DIR / "images" / split
    label_dir = DATASET_DIR / "labels" / split

    images = list(image_dir.glob("*"))
    errors = []

    for image_path in images:
        label_path = label_dir / f"{image_path.stem}.txt"

        if not label_path.is_file():
            errors.append(f"Missing label: {image_path.name}")
            continue

        try:
            with Image.open(image_path) as image:
                image.verify()
        except Exception as error:
            errors.append(
                f"Invalid image {image_path.name}: {error}"
            )
            continue

        for line_number, line in enumerate(
            label_path.read_text().splitlines(),
            start=1,
        ):
            if not line.strip():
                continue

            parts = line.split()

            if len(parts) != 5:
                errors.append(
                    f"Invalid format: {label_path.name}, "
                    f"line {line_number}"
                )
                continue

            try:
                class_id = int(parts[0])
                x_center, y_center, width, height = map(
                    float, parts[1:]
                )
            except ValueError:
                errors.append(
                    f"Invalid values: {label_path.name}, "
                    f"line {line_number}"
                )
                continue

            if class_id not in VALID_CLASS_IDS:
                errors.append(
                    f"Invalid class ID: {label_path.name}, "
                    f"line {line_number}"
                )

            if not (
                0 <= x_center <= 1
                and 0 <= y_center <= 1
                and 0 < width <= 1
                and 0 < height <= 1
            ):
                errors.append(
                    f"Invalid bounding box: {label_path.name}, "
                    f"line {line_number}"
                )

    print(f"\n{split.upper()} DATASET")
    print(f"Images: {len(images)}")
    print(f"Errors: {len(errors)}")

    for error in errors:
        print("ERROR:", error)

    return len(errors)


def main():
    total_errors = 0

    for split in SPLITS:
        total_errors += validate_split(split)

    print("\n" + "=" * 50)

    if total_errors == 0:
        print("DATASET VALIDATION PASSED")
    else:
        print(f"DATASET VALIDATION FAILED: {total_errors} errors")


if __name__ == "__main__":
    main()