-- DropForeignKey
ALTER TABLE "IncidentAIOutput" DROP CONSTRAINT "IncidentAIOutput_incidentId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "declinedResponderIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AddForeignKey
ALTER TABLE "IncidentAIOutput" ADD CONSTRAINT "IncidentAIOutput_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
