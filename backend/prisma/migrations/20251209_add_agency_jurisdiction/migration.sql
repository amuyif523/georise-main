-- AgencyJurisdiction link table
CREATE TABLE "AgencyJurisdiction" (
  id SERIAL PRIMARY KEY,
  "agencyId" INT NOT NULL,
  "boundaryType" VARCHAR(20) NOT NULL,
  "boundaryId" INT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_agency FOREIGN KEY ("agencyId") REFERENCES "Agency"(id) ON DELETE CASCADE
);

CREATE INDEX agency_jurisdiction_boundary_idx ON "AgencyJurisdiction"("boundaryType", "boundaryId");
