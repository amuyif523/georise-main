/*
  Warnings:

  - Made the column `createdAt` on table `AgencyJurisdiction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `reportedAt` on table `Incident` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Responder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Responder` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STATUS_CHANGE', 'COMMENT', 'DISPATCH', 'ASSIGNMENT', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgencyType" ADD VALUE 'ELECTRIC';
ALTER TYPE "AgencyType" ADD VALUE 'WATER';
ALTER TYPE "AgencyType" ADD VALUE 'ENVIRONMENT';
ALTER TYPE "AgencyType" ADD VALUE 'PUBLIC_HEALTH';
ALTER TYPE "AgencyType" ADD VALUE 'CONSTRUCTION';
ALTER TYPE "AgencyType" ADD VALUE 'ADMINISTRATION';

-- DropForeignKey
ALTER TABLE "AgencyJurisdiction" DROP CONSTRAINT "fk_agency";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "incident_responder_fk";

-- DropForeignKey
ALTER TABLE "IncidentAssignment" DROP CONSTRAINT "IncidentAssignment_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "IncidentAssignment" DROP CONSTRAINT "IncidentAssignment_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Responder" DROP CONSTRAINT "Responder_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Responder" DROP CONSTRAINT "Responder_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "Responder" DROP CONSTRAINT "Responder_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResponderUnit" DROP CONSTRAINT "ResponderUnit_agencyId_fkey";

-- DropIndex
DROP INDEX "agency_jurisdiction_boundary_idx";

-- DropIndex
DROP INDEX "incident_location_geom_idx";

-- DropIndex
DROP INDEX "incidentassignment_incident_idx";

-- DropIndex
DROP INDEX "incidentassignment_unit_idx";

-- DropIndex
DROP INDEX "responder_agency_idx";

-- DropIndex
DROP INDEX "responder_incident_idx";

-- DropIndex
DROP INDEX "responderunit_agency_idx";

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "centerLatitude" DOUBLE PRECISION,
ADD COLUMN     "centerLongitude" DOUBLE PRECISION,
ADD COLUMN     "jurisdiction" geometry(Polygon,4326),
ADD COLUMN     "subCityId" INTEGER,
ADD COLUMN     "woredaId" INTEGER;

-- AlterTable
ALTER TABLE "AgencyJurisdiction" ALTER COLUMN "boundaryType" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" INTEGER,
ADD COLUMN     "subCityId" INTEGER,
ADD COLUMN     "woredaId" INTEGER,
ALTER COLUMN "reportedAt" SET NOT NULL,
ALTER COLUMN "reportedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "verifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "dispatchedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "arrivalAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "demoScenarioCode" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "IncidentAssignment" ALTER COLUMN "assignedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "acceptedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "arrivedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "demoScenarioCode" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Responder" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ResponderUnit" ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "type" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "lastSeenAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "demoScenarioCode" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReportAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "rejectedReports" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalReports" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validReports" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "userId" INTEGER,
    "type" "ActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jurisdiction" geometry(Polygon,4326),

    CONSTRAINT "SubCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Woreda" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "subCityId" INTEGER NOT NULL,
    "boundary" geometry(Polygon,4326),

    CONSTRAINT "Woreda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchRule" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "defaultAgencyType" "AgencyType" NOT NULL,

    CONSTRAINT "DispatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubCity_name_key" ON "SubCity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCity_code_key" ON "SubCity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Woreda_subCityId_name_key" ON "Woreda"("subCityId", "name");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_subCityId_fkey" FOREIGN KEY ("subCityId") REFERENCES "SubCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_woredaId_fkey" FOREIGN KEY ("woredaId") REFERENCES "Woreda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedResponderId_fkey" FOREIGN KEY ("assignedResponderId") REFERENCES "Responder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_subCityId_fkey" FOREIGN KEY ("subCityId") REFERENCES "SubCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_woredaId_fkey" FOREIGN KEY ("woredaId") REFERENCES "Woreda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Woreda" ADD CONSTRAINT "Woreda_subCityId_fkey" FOREIGN KEY ("subCityId") REFERENCES "SubCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyJurisdiction" ADD CONSTRAINT "AgencyJurisdiction_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responder" ADD CONSTRAINT "Responder_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responder" ADD CONSTRAINT "Responder_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responder" ADD CONSTRAINT "Responder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponderUnit" ADD CONSTRAINT "ResponderUnit_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAssignment" ADD CONSTRAINT "IncidentAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ResponderUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
