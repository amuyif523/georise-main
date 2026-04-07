-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentIncidentId" INTEGER;

-- CreateIndex
CREATE INDEX "Incident_parentIncidentId_idx" ON "Incident"("parentIncidentId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_parentIncidentId_fkey" FOREIGN KEY ("parentIncidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
