-- Convert incident.location to geometry(POINT,4326) and ensure index
ALTER TABLE "Incident"
  ALTER COLUMN location TYPE geometry(POINT,4326)
  USING ST_SetSRID(location::geometry, 4326);

CREATE INDEX IF NOT EXISTS incident_location_geom_idx
  ON "Incident"
  USING GIST(location);

-- Materialize admin boundaries table if not present (derived from existing Addis subcities/woredas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'et_admin_boundaries') THEN
    -- only attempt to materialize if source tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'addis_subcities')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'addis_woredas') THEN
      CREATE TABLE et_admin_boundaries AS
      SELECT gid AS id, zone_name AS name, 'subcity'::text AS admin_level, geom
      FROM addis_subcities
      UNION ALL
      SELECT gid AS id, COALESCE(woreda_name, zone_name) AS name, 'woreda'::text AS admin_level, geom
      FROM addis_woredas;

      CREATE INDEX IF NOT EXISTS et_admin_boundaries_geom_idx
        ON et_admin_boundaries
        USING GIST(geom);
    END IF;
  END IF;
END$$;
