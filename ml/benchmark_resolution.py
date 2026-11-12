
from pathlib import Path
from time import perf_counter
from statistics import mean, median

from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]

IMAGE_PATH = PROJECT_ROOT / "data/images/test.png"
MODEL_PATH = PROJECT_ROOT / "yolo26n.pt"

RESOLUTIONS = [640, 960]

CONFIDENCE_THRESHOLD = 0.25
WARMUP_RUNS = 3
BENCHMARK_RUNS = 10

TARGET_CLASSES = [0, 1, 2, 16]


def main():
    model = YOLO(str(MODEL_PATH))

    timings = {
        resolution: []
        for resolution in RESOLUTIONS
    }

    print("Loading model:", MODEL_PATH.name)
    print("Device: CPU")
    print("Confidence threshold:", CONFIDENCE_THRESHOLD)
    print("Warm-up runs:", WARMUP_RUNS)
    print("Benchmark runs:", BENCHMARK_RUNS)

    # Warm up both resolutions.
    print("\nWarming up...")

    for resolution in RESOLUTIONS:
        for _ in range(WARMUP_RUNS):
            model.predict(
                source=str(IMAGE_PATH),
                conf=CONFIDENCE_THRESHOLD,
                classes=TARGET_CLASSES,
                imgsz=resolution,
                device="cpu",
                verbose=False,
            )

    # Alternate resolutions to reduce ordering bias.
    print("Benchmarking...")

    for _ in range(BENCHMARK_RUNS):
        for resolution in RESOLUTIONS:
            start_time = perf_counter()

            model.predict(
                source=str(IMAGE_PATH),
                conf=CONFIDENCE_THRESHOLD,
                classes=TARGET_CLASSES,
                imgsz=resolution,
                device="cpu",
                verbose=False,
            )

            elapsed_ms = (perf_counter() - start_time) * 1000

            timings[resolution].append(elapsed_ms)

    # Display results.
    print("\nINFERENCE BENCHMARK RESULTS")
    print("=" * 65)

    for resolution in RESOLUTIONS:
        values = timings[resolution]
        average = mean(values)

        print(f"\nResolution: {resolution} x {resolution}")
        print(f"Average latency: {average:.2f} ms")
        print(f"Median latency:  {median(values):.2f} ms")
        print(f"Minimum latency: {min(values):.2f} ms")
        print(f"Maximum latency: {max(values):.2f} ms")
        print(f"Approximate FPS: {1000 / average:.2f}")

    avg_640 = mean(timings[640])
    avg_960 = mean(timings[960])

    increase = ((avg_960 - avg_640) / avg_640) * 100

    print("\nCOMPARISON")
    print("=" * 65)
    print(f"640 average: {avg_640:.2f} ms")
    print(f"960 average: {avg_960:.2f} ms")
    print(f"Latency increase: {increase:.2f}%")


if __name__ == "__main__":
    main()
