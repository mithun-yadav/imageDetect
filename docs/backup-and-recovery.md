# Backup and Recovery Strategy

## 1. Purpose

This document defines backup and recovery procedures for the Image Detection System.

The primary objective is to protect:

- Trained YOLO model weights.
- Training datasets and annotations.
- Source code and configuration.
- Docker deployment configuration.
- Important application artifacts.

The project currently does not use a database, so database backup and restoration are not applicable.

## 2. Important Project Data

| Resource | Location | Backup Priority |
|---|---|---|
| Trained YOLO model | `runs/train/coco128-four-class/weights/best.pt` | Critical |
| Training results | `runs/train/` | High |
| Training datasets | `data/training/` | High |
| External test images | `data/images/external-test/` | Medium |
| API source | `apps/api/` | High |
| Inference source | `inference/` | High |
| ML scripts | `ml/` | High |
| Docker configuration | `docker-compose.yml`, Dockerfiles | High |
| Documentation | `docs/` | Medium |

Source code is version-controlled through Git. Large model files and datasets should have an independent backup strategy.

## 3. Backup Strategy

Use a combination of:

1. Git for source code and configuration.
2. External storage for trained models and datasets.
3. Versioned backups for important model checkpoints.
4. Periodic recovery tests to verify backup integrity.

Do not rely exclusively on the production server as the backup location.

Recommended storage options include:
- External storage with restricted access.
- Private object storage.
- Encrypted remote backup storage.

Keep production data and backups in separate failure domains.

## 4. Backup the Trained Model

The trained model is essential for inference.

Default location:

```text
runs/train/coco128-four-class/weights/best.pt
```

Create a backup directory:

```bash
mkdir -p backups/models
```

Copy the model:

```bash
cp runs/train/coco128-four-class/weights/best.pt \
   backups/models/best-$(date +%Y%m%d-%H%M%S).pt
```

Verify the backup:

```bash
ls -lh backups/models/
```

Generate a checksum:

```bash
sha256sum backups/models/*.pt
```

Store the checksum separately from the backup.

Transfer the backup to independent storage. A backup stored only on the same server does not protect against server or disk failure.

## 5. Backup Training Data

Training datasets may require significant storage.

Important locations include:

```text
data/training/
data/images/
```

Create a compressed archive when a dataset snapshot is required:

```bash
tar -czf dataset-backup-$(date +%Y%m%d).tar.gz \
  data/training/
```

Verify the archive:

```bash
tar -tzf dataset-backup-YYYYMMDD.tar.gz | head
```

Replace `YYYYMMDD` with the actual backup date.

Keep dataset annotations and configuration files alongside the corresponding dataset version.

Do not assume generated datasets can always be reconstructed from downloaded source data.

## 6. Backup Docker and Deployment Configuration

The following files should remain version-controlled:

```text
docker-compose.yml
apps/api/Dockerfile
apps/api/.dockerignore
inference/Dockerfile
inference/.dockerignore
.gitignore
```

Production environment files must be backed up separately and securely.

Never commit:
- `.env` files containing actual configuration secrets.
- API credentials.
- Private keys.
- Authentication tokens.

The `.env.example` files should contain placeholders only.

## 7. Recovery: Restore a Trained Model

If the production model is lost:

1. Retrieve the latest verified model backup.
2. Create the expected directory.
3. Restore the model.
4. Verify its checksum.
5. Restart the inference service.
6. Verify inference health and detection functionality.

Example:

```bash
mkdir -p runs/train/coco128-four-class/weights

cp /path/to/backup/best.pt \
   runs/train/coco128-four-class/weights/best.pt
```

Verify the model:

```bash
ls -lh runs/train/coco128-four-class/weights/best.pt
sha256sum runs/train/coco128-four-class/weights/best.pt
```

Restart inference:

```bash
docker compose up -d inference
```

Verify service health:

```bash
docker compose ps
docker compose logs --tail=100 inference
```

Test API readiness:

```bash
curl http://localhost:3000/api/v1/health/ready
```

Finally, submit a test image through the detection API.

## 8. Recovery: Restore Source Code

If the application source code is lost:

Clone the repository:

```bash
git clone <REPOSITORY_URL>
cd image-detection-system
```

Checkout the previously deployed commit:

```bash
git checkout <KNOWN_GOOD_COMMIT>
```

Restore:
- Production environment configuration.
- Trained model files.
- Any required datasets or external artifacts.

Rebuild and start:

```bash
docker compose up -d --build
```

Verify both services:

```bash
docker compose ps
docker compose logs --tail=100
```

Test readiness and image detection before considering the recovery complete.

## 9. Recovery: Docker Image Failure

If a Docker image becomes corrupted or unavailable locally, rebuild it from the repository:

```bash
docker compose build --no-cache
docker compose up -d
```

If the production server is unavailable, deploy the same known-good Git commit and restore its required model and configuration from independent backups.

## 10. Recovery Verification Checklist

After restoring the system, verify:

- [ ] Source code is restored to the intended commit.
- [ ] Production environment configuration is available.
- [ ] Model file exists at the expected location.
- [ ] Model checksum matches the backup record.
- [ ] Inference container starts successfully.
- [ ] API container starts successfully.
- [ ] Both containers report healthy status.
- [ ] API readiness endpoint returns HTTP 200.
- [ ] Swagger documentation is accessible.
- [ ] Test image detection succeeds.
- [ ] Detection results contain expected output fields.
- [ ] Logs do not contain unresolved startup or inference errors.

Recovery is complete only after a successful end-to-end detection test.

## 11. Backup Schedule

Suggested initial schedule:

| Resource | Frequency |
|---|---|
| Trained model | After every approved training release |
| Training datasets | After dataset changes or new dataset releases |
| Source code | Every meaningful change through Git |
| Deployment configuration | Every production configuration change |
| Production environment configuration | After changes, using secure backup storage |

Review the backup schedule according to storage costs, model update frequency, and recovery requirements.

## 12. Recovery Objectives

The following are initial operational targets, not measured guarantees:

| Metric | Initial Target |
|---|---|
| Recovery Time Objective (RTO) | Within 4 hours |
| Recovery Point Objective (RPO) for approved models | Latest successful model backup |
| Source code recovery | Latest pushed, known-good commit |
| Dataset recovery | Latest verified dataset backup |

These targets should be validated through actual recovery exercises.

## 13. Important Considerations

- Keep at least one independent copy of critical model backups.
- Verify backup integrity rather than relying only on successful copy operations.
- Restrict access to production backups.
- Encrypt sensitive configuration backups.
- Avoid deleting old model checkpoints immediately after a new deployment.
- Document the Git commit associated with every production model release.
- Perform periodic restoration tests.
- Never use destructive Docker cleanup commands without understanding their impact on required images, volumes, and data.

## 14. Current Limitations

The project currently has no database or persistent application data store.

Automated backup scheduling, remote object-storage integration, encryption automation, and disaster-recovery orchestration have not yet been implemented.

These can be introduced as the project moves toward a larger production deployment.