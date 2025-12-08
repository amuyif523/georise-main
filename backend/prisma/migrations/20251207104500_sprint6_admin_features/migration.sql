-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Agency governance fields
ALTER TABLE "Agency"
ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "boundary" geometry(Polygon, 4326);

-- Audit log table
CREATE TABLE IF NOT EXISTS "AuditLog" (
    id SERIAL PRIMARY KEY,
    "actorId" INTEGER NOT NULL REFERENCES "User"(id),
    action TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER,
    note TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
