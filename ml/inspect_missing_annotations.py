
from pathlib import Path
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_DIR = PROJECT_ROOT / "data/public/coco128/images/train2017"

MISSING_IDS = [
    "000000000250",
    "000000000508",
]

THUMBNAIL_SIZE = (500, 350)
CELL_HEIGHT = 390

canvas = Image.new("RGB", (1020, CELL_HEIGHT), "white")
draw = ImageDraw.Draw(canvas)

for index, image_id in enumerate(MISSING_IDS):
    image_path = next(
        (
            path for path in IMAGE_DIR.glob(f"{image_id}.*")
            if path.is_file()
        ),
        None,
    )

    if image_path is None:
        print(f"Image not found: {image_id}")
        continue

    with Image.open(image_path) as image:
        image.thumbnail(THUMBNAIL_SIZE)

        x = index * 510 + (510 - image.width) // 2
        y = 30 + (350 - image.height) // 2

        canvas.paste(image, (x, y))

        draw.text(
            (index * 510 + 10, 10),
            image_id,
            fill="black",
        )

output_path = PROJECT_ROOT / "data/public/missing-annotations-review.jpg"
canvas.save(output_path)

print(f"Contact sheet saved: {output_path}")
