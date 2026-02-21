/*
  Warnings:

  - Made the column `centerLatitude` on table `Agency` required. This step will fail if there are existing NULL values in that column.
  - Made the column `centerLongitude` on table `Agency` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'TRIAGE_UPDATE';

-- AlterTable
ALTER TABLE "Agency" ALTER COLUMN "centerLatitude" SET NOT NULL,
ALTER COLUMN "centerLongitude" SET NOT NULL;

-- AlterTable
ALTER TABLE "Responder" ADD COLUMN     "breadcrumbs" JSONB DEFAULT '[]',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ClassificationAudit" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "correctorId" INTEGER NOT NULL,
    "originalCategory" TEXT,
    "correctedCategory" TEXT NOT NULL,
    "originalSeverity" INTEGER,
    "correctedSeverity" INTEGER NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClassificationAudit" ADD CONSTRAINT "ClassificationAudit_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationAudit" ADD CONSTRAINT "ClassificationAudit_correctorId_fkey" FOREIGN KEY ("correctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
