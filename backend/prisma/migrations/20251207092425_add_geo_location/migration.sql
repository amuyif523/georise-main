-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "location" geography(Point,4326);
