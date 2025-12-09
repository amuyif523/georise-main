-- Sprint 27: add demo flags for incidents, responder units, assignments

ALTER TABLE "Incident"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoScenarioCode" VARCHAR;

ALTER TABLE "ResponderUnit"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoScenarioCode" VARCHAR;

ALTER TABLE "IncidentAssignment"
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoScenarioCode" VARCHAR;
