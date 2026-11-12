
from pathlib import Path
import numpy as np

from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]

model = YOLO(str(PROJECT_ROOT / "yolo26n.pt"))

metrics = model.val(
    data=str(PROJECT_ROOT / "data/coco-evaluation/data.yaml"),
    imgsz=640,
    device="cpu",
    classes=[0, 1, 2, 16],
    plots=False,
    verbose=False,
)

class_names = model.names

print("\nClass-wise validation details")
print("-" * 65)

for class_id, class_name in class_names.items():
    if class_id not in [0, 1, 2, 16]:
        continue

    if class_id not in metrics.box.ap_class_index:
        continue

    index = list(metrics.box.ap_class_index).index(class_id)

    precision = metrics.box.p[index]
    recall = metrics.box.r[index]
    ap50 = metrics.box.ap50[index]
    ap = metrics.box.ap[index]

    print(f"\n{class_name}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"AP50:      {ap50:.4f}")
    print(f"AP50-95:   {ap:.4f}")
