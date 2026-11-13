
from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    PROJECT_ROOT
    / "runs"
    / "train"
    / "coco128-four-class"
    / "weights"
    / "best.pt"
)

IMAGE_DIR = PROJECT_ROOT / "data" / "images" / "external-test"

OUTPUT_DIR = PROJECT_ROOT / "runs" / "predict"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}

CONFIDENCE_THRESHOLD = 0.40


def main():
    image_paths = [
        path
        for path in IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]

    if not image_paths:
        raise FileNotFoundError(
            f"No images found in {IMAGE_DIR}"
        )

    print(f"Images found: {len(image_paths)}")

    model = YOLO(str(MODEL_PATH))

    results = model.predict(
        source=str(IMAGE_DIR),
        imgsz=640,
        conf=CONFIDENCE_THRESHOLD,
        device="cpu",
        save=True,
        project=str(OUTPUT_DIR),
        name=f"external-test-conf-{CONFIDENCE_THRESHOLD}",
        exist_ok=True,
        verbose=False,
    )

    total_detections = 0

    print("\nPREDICTION RESULTS")
    print("=" * 55)

    for result in results:
        detections = len(result.boxes)
        total_detections += detections

        print(f"\nImage: {Path(result.path).name}")
        print(f"Detections: {detections}")

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            class_name = model.names[class_id]

            print(f"  {class_name}: {confidence:.2%}")

    print("\n" + "=" * 55)
    print(f"Total images: {len(results)}")
    print(f"Total detections: {total_detections}")
    print(
        f"Confidence threshold: {CONFIDENCE_THRESHOLD}"
    )
    print(
        f"Saved predictions: "
        f"{OUTPUT_DIR / f'external-test-conf-{CONFIDENCE_THRESHOLD}'}"
    )


if __name__ == "__main__":
    main()
