-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Agency_id_deletedAt_idx" ON "Agency"("id", "deletedAt");

-- CreateIndex
CREATE INDEX "Incident_id_deletedAt_idx" ON "Incident"("id", "deletedAt");

-- CreateIndex
CREATE INDEX "User_id_deletedAt_idx" ON "User"("id", "deletedAt");
