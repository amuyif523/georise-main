-- AlterEnum
ALTER TYPE "ResponderStatus" ADD VALUE 'STANDBY';

-- AlterTable
ALTER TABLE "Responder" ADD COLUMN     "subCityId" INTEGER,
ADD COLUMN     "woredaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Responder" ADD CONSTRAINT "Responder_subCityId_fkey" FOREIGN KEY ("subCityId") REFERENCES "SubCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responder" ADD CONSTRAINT "Responder_woredaId_fkey" FOREIGN KEY ("woredaId") REFERENCES "Woreda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
