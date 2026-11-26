-- CreateEnum
CREATE TYPE "InferenceStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "InferenceMetric" (
    "id" UUID NOT NULL,
    "status" "InferenceStatus" NOT NULL,
    "modelName" TEXT,
    "processingTimeMs" DOUBLE PRECISION,
    "requestDurationMs" DOUBLE PRECISION NOT NULL,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InferenceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InferenceMetric_createdAt_idx" ON "InferenceMetric"("createdAt");

-- CreateIndex
CREATE INDEX "InferenceMetric_status_createdAt_idx" ON "InferenceMetric"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InferenceMetric_modelName_createdAt_idx" ON "InferenceMetric"("modelName", "createdAt");
