
from contextlib import asynccontextmanager
from io import BytesIO
from time import perf_counter

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.detector import ObjectDetector


MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB

detector = ObjectDetector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once when the service starts.
    detector.load_model()

    yield

    # Release the model reference during shutdown.
    detector.model = None


app = FastAPI(
    title="Object Detection Inference API",
    description="YOLO-based four-class object detection service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok" if detector.model is not None else "unavailable",
        "model_loaded": detector.model is not None,
        "model_path": str(detector.model_path),
        "device": detector.device,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG and WebP images are supported",
        )

    contents = await file.read(MAX_IMAGE_SIZE + 1)

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB limit",
        )

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty",
        )

    try:
        image = Image.open(BytesIO(contents))
        image.load()

        if image.format not in {"JPEG", "PNG", "WEBP"}:
            raise HTTPException(
                status_code=415,
                detail="Unsupported image format",
            )

    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image",
        )

    if detector.model is None:
        raise HTTPException(
            status_code=503,
            detail="Inference model is not available",
        )

    start_time = perf_counter()

    try:
        result = detector.predict(image)

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Object detection failed",
        )

    processing_time = (perf_counter() - start_time) * 1000

    return {
        "success": True,
        "filename": file.filename,
        "model": detector.model_path.name,
        "confidence_threshold": detector.confidence,
        "processing_time_ms": round(processing_time, 2),
        "result": result,
    }
