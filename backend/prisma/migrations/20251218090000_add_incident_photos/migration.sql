-- CreateTable
CREATE TABLE "IncidentPhoto" (
    "id" TEXT NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "uploadedById" INTEGER,
    "url" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IncidentPhoto" ADD CONSTRAINT "IncidentPhoto_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentPhoto" ADD CONSTRAINT "IncidentPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
