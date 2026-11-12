
from pathlib import Path

import cv2

PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_PATH = PROJECT_ROOT / "data/dataset/images/val/test.png"
LABEL_PATH = PROJECT_ROOT / "data/dataset/labels/val/test.txt"

OUTPUT_PATH = PROJECT_ROOT / "runs/detect/ground-truth.png"

CLASS_NAMES = {
    0: "person",
    1: "car",
    2: "bicycle",
    3: "dog",
}


def main():
    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        raise FileNotFoundError(f"Image not found: {IMAGE_PATH}")

    height, width = image.shape[:2]

    with open(LABEL_PATH, encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]

    for line in lines:
        class_id, xc, yc, bw, bh = line.split()

        class_id = int(class_id)
        xc, yc, bw, bh = map(float, (xc, yc, bw, bh))

        x1 = int((xc - bw / 2) * width)
        y1 = int((yc - bh / 2) * height)
        x2 = int((xc + bw / 2) * width)
        y2 = int((yc + bh / 2) * height)

        class_name = CLASS_NAMES[class_id]

        cv2.rectangle(
            image,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        cv2.putText(
            image,
            class_name,
            (x1, max(y1 - 8, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    cv2.imwrite(str(OUTPUT_PATH), image)

    print("Ground-truth visualization saved:")
    print(OUTPUT_PATH)
    print("Total annotations:", len(lines))


if __name__ == "__main__":
    main()
