-- Responder table and incident timing fields
CREATE TYPE "ResponderStatus" AS ENUM ('AVAILABLE','ASSIGNED','EN_ROUTE','ON_SCENE','OFFLINE');

ALTER TABLE "Incident"
ADD COLUMN IF NOT EXISTS "assignedResponderId" INT,
ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "arrivalAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP;

CREATE TABLE IF NOT EXISTS "Responder" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status "ResponderStatus" NOT NULL DEFAULT 'AVAILABLE',
  "agencyId" INT NOT NULL REFERENCES "Agency"(id) ON DELETE CASCADE,
  "incidentId" INT NULL REFERENCES "Incident"(id) ON DELETE SET NULL,
  "userId" INT NULL REFERENCES "User"(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX responder_agency_idx ON "Responder"("agencyId");
CREATE INDEX responder_incident_idx ON "Responder"("incidentId");

ALTER TABLE "Incident"
ADD CONSTRAINT incident_responder_fk FOREIGN KEY ("assignedResponderId") REFERENCES "Responder"(id) ON DELETE SET NULL;
