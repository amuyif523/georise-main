-- Sprint 25: responder units and incident assignments

CREATE TABLE IF NOT EXISTS "ResponderUnit" (
    id          SERIAL PRIMARY KEY,
    "agencyId"  INTEGER NOT NULL REFERENCES "Agency"(id) ON DELETE CASCADE,
    name        VARCHAR NOT NULL,
    type        VARCHAR,
    "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
    status      VARCHAR NOT NULL DEFAULT 'AVAILABLE',
    "lastLat"   DOUBLE PRECISION,
    "lastLon"   DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "IncidentAssignment" (
    id          SERIAL PRIMARY KEY,
    "incidentId" INTEGER NOT NULL REFERENCES "Incident"(id) ON DELETE CASCADE,
    "unitId"     INTEGER NOT NULL REFERENCES "ResponderUnit"(id) ON DELETE CASCADE,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "acceptedAt" TIMESTAMPTZ,
    "arrivedAt"  TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS responderunit_agency_idx ON "ResponderUnit"("agencyId");
CREATE INDEX IF NOT EXISTS incidentassignment_incident_idx ON "IncidentAssignment"("incidentId");
CREATE INDEX IF NOT EXISTS incidentassignment_unit_idx ON "IncidentAssignment"("unitId");
