from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_YAML = (
    PROJECT_ROOT
    / "data/training/coco128-four-class/data.yaml"
)

PRETRAINED_MODEL = "yolo26n.pt"

TRAINED_MODEL = (
    PROJECT_ROOT
    / "runs/train/coco128-four-class/weights/best.pt"
)


def evaluate_model(model_path, model_name):
    print(f"\nEvaluating: {model_name}")
    print("=" * 50)

    model = YOLO(str(model_path))

    metrics = model.val(
        data=str(DATA_YAML),
        imgsz=640,
        batch=8,
        device="cpu",
        plots=False,
        verbose=False,
    )

    return {
        "model": model_name,
        "precision": metrics.box.mp,
        "recall": metrics.box.mr,
        "map50": metrics.box.map50,
        "map50_95": metrics.box.map,
    }


def main():
    results = []

    results.append(
        evaluate_model(
            PRETRAINED_MODEL,
            "Original YOLO26n",
        )
    )

    results.append(
        evaluate_model(
            TRAINED_MODEL,
            "Fine-tuned YOLO26n",
        )
    )

    print("\nMODEL COMPARISON")
    print("=" * 75)

    for result in results:
        print(f"\n{result['model']}")
        print(f"Precision: {result['precision']:.4f}")
        print(f"Recall:    {result['recall']:.4f}")
        print(f"mAP50:     {result['map50']:.4f}")
        print(f"mAP50-95:  {result['map50_95']:.4f}")


if __name__ == "__main__":
    main()