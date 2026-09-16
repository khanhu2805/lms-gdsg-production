-- CreateEnum
CREATE TYPE "MaterialPreviewStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'GENERATE_DOCUMENT_PREVIEW';

-- DropIndex
DROP INDEX "materials_assetId_idx";

-- DropIndex
DROP INDEX "recordings_assetId_idx";

-- DropIndex
DROP INDEX "recordings_thumbnailAssetId_idx";

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "previewError" TEXT,
ADD COLUMN     "previewStatus" "MaterialPreviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "previewStorageKey" TEXT;
