-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "initialTrustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- CreateIndex
CREATE INDEX "Incident_initialTrustScore_idx" ON "Incident"("initialTrustScore");
