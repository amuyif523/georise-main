-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_reporterId_fkey";

-- AlterTable
ALTER TABLE "Incident" ALTER COLUMN "reporterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
