# Production Deployment Guide

## 1. Overview

The application consists of two Docker services:

| Service | Technology | Internal Port | Purpose |
|---|---|---:|---|
| API | NestJS / Node.js | 3000 | Handles client requests and coordinates inference |
| Inference | FastAPI / Python / YOLO | 8000 | Performs image detection |

The API communicates with the inference service through Docker's internal network.

The inference service is not directly exposed to the host machine.

## 2. Prerequisites

The production server must have:

- Linux server
- Docker Engine
- Docker Compose V2
- Git
- Sufficient disk space for Docker images and model files
- At least 4 GB RAM recommended for the configured container limits

Configured container resource limits:

| Service | CPU | Memory |
|---|---:|---:|
| API | 1 CPU | 512 MB |
| Inference | 2 CPUs | 2 GB |

The inference service currently uses CPU-based processing.

## 3. Clone the Repository

Clone the project onto the production server:

```bash
git clone <REPOSITORY_URL>
cd image-detection-system
```

Checkout the intended deployment branch:

```bash
git checkout feature/docker-compose-setup
```

Use the appropriate production branch when one is established.

## 4. Configure the Environment

Create the root environment file:

```bash
touch .env
```

Available optional configuration:

```env
API_PORT=3000
CONFIDENCE_THRESHOLD=0.25
IMAGE_SIZE=640
DEVICE=cpu
MODEL_HOST_PATH=./runs/train/coco128-four-class/weights/best.pt
```

These variables are consumed by Docker Compose.

| Variable | Default | Description |
|---|---|---|
| API_PORT | 3000 | Host port for the API |
| CONFIDENCE_THRESHOLD | 0.25 | Minimum detection confidence |
| IMAGE_SIZE | 640 | Inference image size |
| DEVICE | cpu | Inference device |
| MODEL_HOST_PATH | Model path shown above | Host location of the trained model |

Keep `.env` out of Git. Never put credentials or private keys in committed environment example files.

## 5. Prepare the Model

The inference service requires a trained YOLO model.

Expected default location:

```text
runs/train/coco128-four-class/weights/best.pt
```

Create the directory if necessary:

```bash
mkdir -p runs/train/coco128-four-class/weights
```

Transfer the trained model to that location.

Verify it exists:

```bash
ls -lh runs/train/coco128-four-class/weights/best.pt
```

If the model is stored elsewhere, configure `MODEL_HOST_PATH` in `.env`.

The model is mounted read-only inside the inference container at:

```text
/models/best.pt
```

## 6. Build and Start the Application

Build both images:

```bash
docker compose build
```

Start the services:

```bash
docker compose up -d
```

Alternatively, combine both operations:

```bash
docker compose up -d --build
```

The API waits for the inference service to become healthy before starting.

## 7. Verify Deployment

Check container status:

```bash
docker compose ps
```

Both services should report healthy status.

Check API readiness:

```bash
curl http://localhost:3000/api/v1/health/ready
```

Check Swagger documentation:

```text
http://localhost:3000/api/docs
```

Test image detection:

```bash
curl -X POST \
  http://localhost:3000/api/v1/detections \
  -F "file=@data/images/external-test/train-image-9.jpg"
```

Use an available test image on the server.

## 8. Logs and Monitoring

View all service logs:

```bash
docker compose logs
```

Follow logs continuously:

```bash
docker compose logs -f
```

View individual service logs:

```bash
docker compose logs -f api
docker compose logs -f inference
```

Check resource consumption:

```bash
docker stats
```

Check container health:

```bash
docker inspect \
  --format='{{json .State.Health}}' \
  image-detection-api

docker inspect \
  --format='{{json .State.Health}}' \
  image-detection-inference
```

## 9. Updating the Application

Before deploying an update, record the current Git commit:

```bash
git rev-parse HEAD
```

Fetch the latest code:

```bash
git pull origin feature/docker-compose-setup
```

Rebuild and restart:

```bash
docker compose up -d --build
```

Verify deployment:

```bash
docker compose ps
docker compose logs --tail=100
```

Check the API readiness endpoint and test image detection.

## 10. Rollback Procedure

If a deployment introduces problems:

1. Identify the previously working Git commit.
2. Checkout that commit.
3. Rebuild and restart the services.
4. Verify readiness and detection functionality.

Example:

```bash
git checkout <PREVIOUS_WORKING_COMMIT>
docker compose up -d --build
```

Do not remove model files or persistent data during rollback.

Return to the intended branch after completing the rollback investigation.

## 11. Shutdown and Restart

Stop services:

```bash
docker compose down
```

Restart services:

```bash
docker compose up -d
```

Restart an individual service:

```bash
docker compose restart api
docker compose restart inference
```

Avoid `docker compose down -v` unless intentionally removing associated volumes.

## 12. Production Security Considerations

The current Compose configuration includes:

- Non-root container execution
- Read-only container root filesystems
- Dropped Linux capabilities
- `no-new-privileges`
- Resource limits
- Restricted inference port exposure
- Read-only model mount
- Container health checks
- Bounded container log files

Additional production requirements:

- Put the API behind a reverse proxy with HTTPS.
- Restrict direct access to the API host port using firewall rules.
- Keep Docker and host operating system packages updated.
- Protect environment files and model files with appropriate filesystem permissions.
- Do not expose the inference service publicly.
- Maintain an independent backup of the trained model and important project data.

## 13. Important Notes

- Docker Compose currently builds images locally.
- The inference service uses CPU execution.
- The model must exist before starting the inference service.
- The API readiness endpoint checks inference availability.
- Compose startup dependencies do not automatically restart the API when inference becomes unhealthy later.
- This deployment guide does not configure a reverse proxy, TLS certificates, automated backups, or a container registry. Those require separate deployment configuration.