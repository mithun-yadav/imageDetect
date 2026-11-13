from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_YAML = (
    PROJECT_ROOT
    / "data"
    / "training"
    / "coco128-four-class"
    / "data.yaml"
)

MODEL_NAME = "yolo26n.pt"


def main():
    # Load pretrained YOLO26 nano weights.
    model = YOLO(MODEL_NAME)

    # Fine-tune on our four-class dataset.
    results = model.train(
        data=str(DATA_YAML),
        epochs=20,
        imgsz=640,
        batch=8,
        device="cpu",
        workers=4,
        project=str(PROJECT_ROOT / "runs" / "train"),
        name="coco128-four-class",
        plots=True,
        save=True,
    )

    print("\nTraining completed.")
    print(f"Results: {results}")


if __name__ == "__main__":
    main()