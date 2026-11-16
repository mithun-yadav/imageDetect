
from pathlib import Path
import random

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATASET_ROOT = PROJECT_ROOT / "data/training/coco2017-four-class"
OUTPUT_DIR = PROJECT_ROOT / "runs/annotations"

CLASS_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "dog",
}

SAMPLES_PER_SPLIT = 12
SEED = 42
TILE_WIDTH = 480
TILE_HEIGHT = 360
COLUMNS = 3
TITLE_HEIGHT = 35


def annotate_image(image_path, label_path):
    image = cv2.imread(str(image_path))

    if image is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    height, width = image.shape[:2]

    if label_path.exists():
        lines = [
            line.strip()
            for line in label_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    else:
        lines = []

    for line in lines:
        values = line.split()

        if len(values) != 5:
            raise ValueError(f"Invalid annotation in {label_path}: {line}")

        class_id = int(values[0])
        xc, yc, bw, bh = map(float, values[1:])

        if class_id not in CLASS_NAMES:
            raise ValueError(f"Unknown class ID {class_id} in {label_path}")

        x1 = round((xc - bw / 2) * width)
        y1 = round((yc - bh / 2) * height)
        x2 = round((xc + bw / 2) * width)
        y2 = round((yc + bh / 2) * height)

        cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

        cv2.putText(
            image,
            CLASS_NAMES[class_id],
            (x1, max(y1 - 8, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 0),
            2,
        )

    return image, len(lines)


def create_contact_sheet(split):
    image_dir = DATASET_ROOT / "images" / split
    label_dir = DATASET_ROOT / "labels" / split

    image_paths = sorted(image_dir.glob("*.jpg"))

    if not image_paths:
        raise RuntimeError(f"No images found in {image_dir}")

    rng = random.Random(SEED)
    selected = rng.sample(
        image_paths,
        min(SAMPLES_PER_SPLIT, len(image_paths)),
    )

    tiles = []

    for image_path in selected:
        label_path = label_dir / f"{image_path.stem}.txt"
        image, annotation_count = annotate_image(image_path, label_path)

        image = cv2.resize(
            image,
            (TILE_WIDTH, TILE_HEIGHT),
            interpolation=cv2.INTER_AREA,
        )

        tile = np.zeros(
            (TILE_HEIGHT + TITLE_HEIGHT, TILE_WIDTH, 3),
            dtype=np.uint8,
        )

        tile[TITLE_HEIGHT:, :] = image

        title = f"{image_path.stem} | {annotation_count} objects"

        cv2.putText(
            tile,
            title,
            (8, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
        )

        tiles.append(tile)

    rows = []

    for index in range(0, len(tiles), COLUMNS):
        row_tiles = tiles[index:index + COLUMNS]

        while len(row_tiles) < COLUMNS:
            row_tiles.append(
                np.zeros_like(tiles[0])
            )

        rows.append(np.hstack(row_tiles))

    contact_sheet = np.vstack(rows)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output_path = OUTPUT_DIR / f"{split}-annotations.png"

    if not cv2.imwrite(str(output_path), contact_sheet):
        raise RuntimeError(f"Could not save contact sheet: {output_path}")

    print(f"{split}: {len(selected)} images visualized")
    print(f"Saved: {output_path}")


def main():
    create_contact_sheet("train")
    create_contact_sheet("val")


if __name__ == "__main__":
    main()
