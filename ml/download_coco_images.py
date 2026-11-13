
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]

MANIFEST_PATH = (
    PROJECT_ROOT / "data/public/coco2017/selection_manifest.json"
)

OUTPUT_DIR = (
    PROJECT_ROOT / "data/public/coco2017/images/train2017"
)

MAX_RETRIES = 3
TIMEOUT_SECONDS = 30
RETRY_DELAY_SECONDS = 2

USER_AGENT = "ImageDetectionLearningProject/1.0"


def validate_url(url):
    parsed = urllib.parse.urlparse(url)

    if (
        parsed.scheme != "http"
        or parsed.hostname != "images.cocodataset.org"
        or not parsed.path.startswith("/train2017/")
    ):
        raise ValueError(f"Unexpected COCO image URL: {url}")


def verify_image(path, expected_width, expected_height):
    try:
        with Image.open(path) as image:
            image.verify()

        with Image.open(path) as image:
            if image.size != (expected_width, expected_height):
                raise ValueError(
                    f"Dimension mismatch for {path.name}: "
                    f"expected {(expected_width, expected_height)}, "
                    f"got {image.size}"
                )

            if image.format != "JPEG":
                raise ValueError(
                    f"Expected JPEG, got {image.format}: {path.name}"
                )

        return True

    except (OSError, ValueError):
        raise


def download_image(record):
    filename = Path(record["file_name"]).name

    if filename != record["file_name"]:
        raise ValueError(f"Unsafe filename: {record['file_name']}")

    if Path(filename).suffix.lower() not in {".jpg", ".jpeg"}:
        raise ValueError(f"Unexpected image extension: {filename}")

    url = record["coco_url"]
    validate_url(url)

    width = record["width"]
    height = record["height"]

    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid expected dimensions: {filename}")

    destination = OUTPUT_DIR / filename
    temporary = OUTPUT_DIR / f"{filename}.part"

    # Skip an existing image only if it passes verification.
    if destination.exists():
        verify_image(destination, width, height)
        return "skipped"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT},
            )

            with urllib.request.urlopen(
                request,
                timeout=TIMEOUT_SECONDS,
            ) as response:
                with temporary.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)

                        if not chunk:
                            break

                        output.write(chunk)

            verify_image(temporary, width, height)

            # Publish only after successful verification.
            temporary.replace(destination)

            return "downloaded"

        except Exception as error:
            temporary.unlink(missing_ok=True)

            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"Failed to download {filename} "
                    f"after {MAX_RETRIES} attempts: {error}"
                ) from error

            print(
                f"Retry {attempt}/{MAX_RETRIES} for "
                f"{filename}: {error}"
            )

            time.sleep(RETRY_DELAY_SECONDS * attempt)

    raise RuntimeError(f"Unexpected download failure: {filename}")


def main():
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(MANIFEST_PATH)

    with MANIFEST_PATH.open("r", encoding="utf-8") as file:
        manifest = json.load(file)

    records = manifest["images"]

    if len(records) != manifest["selected_image_count"]:
        raise ValueError("Manifest image count does not match records")

    image_ids = [record["image_id"] for record in records]
    filenames = [record["file_name"] for record in records]

    if len(image_ids) != len(set(image_ids)):
        raise ValueError("Duplicate image IDs in manifest")

    if len(filenames) != len(set(filenames)):
        raise ValueError("Duplicate filenames in manifest")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    failed = []

    print(f"Images to process: {len(records)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 65)

    for index, record in enumerate(records, start=1):
        filename = record["file_name"]

        try:
            result = download_image(record)

            if result == "downloaded":
                downloaded += 1
            else:
                skipped += 1

            print(
                f"[{index}/{len(records)}] "
                f"{result.upper():<10} {filename}"
            )

        except Exception as error:
            failed.append({
                "image_id": record["image_id"],
                "file_name": filename,
                "error": str(error),
            })

            print(f"[{index}/{len(records)}] FAILED {filename}")
            print(f"    {error}")

    print("\nDOWNLOAD SUMMARY")
    print("=" * 65)
    print(f"Total selected: {len(records)}")
    print(f"Downloaded: {downloaded}")
    print(f"Already verified: {skipped}")
    print(f"Failed: {len(failed)}")

    print(f"\nImage directory: {OUTPUT_DIR}")

    if failed:
        failure_path = (
            PROJECT_ROOT
            / "data/public/coco2017/download_failures.json"
        )

        with failure_path.open("w", encoding="utf-8") as file:
            json.dump(failed, file, indent=2)

        print(f"Failure report: {failure_path}")
        raise SystemExit(1)

    print("\nAll selected images downloaded and verified.")


if __name__ == "__main__":
    main()
