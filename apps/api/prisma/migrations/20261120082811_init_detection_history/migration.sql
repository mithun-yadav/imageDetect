-- CreateTable
CREATE TABLE "Detection" (
    "id" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL,
    "processingTimeMs" DOUBLE PRECISION NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "totalDetections" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Detection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectionItem" (
    "id" UUID NOT NULL,
    "detectionId" UUID NOT NULL,
    "classId" INTEGER NOT NULL,
    "className" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "x1" DOUBLE PRECISION NOT NULL,
    "y1" DOUBLE PRECISION NOT NULL,
    "x2" DOUBLE PRECISION NOT NULL,
    "y2" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Detection_storageKey_key" ON "Detection"("storageKey");

-- CreateIndex
CREATE INDEX "Detection_createdAt_idx" ON "Detection"("createdAt");

-- CreateIndex
CREATE INDEX "Detection_model_createdAt_idx" ON "Detection"("model", "createdAt");

-- CreateIndex
CREATE INDEX "DetectionItem_detectionId_idx" ON "DetectionItem"("detectionId");

-- CreateIndex
CREATE INDEX "DetectionItem_className_idx" ON "DetectionItem"("className");

-- AddForeignKey
ALTER TABLE "DetectionItem" ADD CONSTRAINT "DetectionItem_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "Detection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
