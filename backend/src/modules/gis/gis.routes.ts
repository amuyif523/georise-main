import { Router } from "express";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

// Legacy subcity endpoint (kept for compatibility)
router.get(
  "/subcities",
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
  async (_req, res) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, code, ST_AsGeoJSON(jurisdiction) AS geojson
      FROM "SubCity"
      WHERE jurisdiction IS NOT NULL;
    `);
    const features = rows.map((r) => ({
      type: "Feature",
      properties: { id: r.id, name: r.name, code: r.code },
      geometry: r.geojson ? JSON.parse(r.geojson) : null,
    }));
    return res.json({ type: "FeatureCollection", features });
  }
);

// Generic imported boundaries from Ethiopia_AdminBoundaries.geojson
router.get("/boundaries", requireAuth, async (req, res) => {
  const level = (req.query.level as string) || "subcity";
  if (level === "woreda") {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT gid, zone_name, woreda_name, ST_AsGeoJSON(geom) AS geometry
      FROM addis_woredas
    `);
    return res.json(rows);
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT gid, zone_name, ST_AsGeoJSON(geom) AS geometry
    FROM addis_subcities
  `);
  return res.json(rows);
});

router.get("/boundaries/:id/incidents", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const level = (req.query.level as string) || "subcity";
  const table = level === "woreda" ? "addis_woredas" : "addis_subcities";
  const incidents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT i.id, i.title, i.status, i.latitude, i.longitude
    FROM "Incident" i
    JOIN ${table} b
      ON ST_Contains(b.geom, i.location)
    WHERE b.gid = ${id}
  `);
  res.json(incidents);
});

router.get("/incident/:id/context", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const context = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      i.id,
      i.title,
      sub.zone_name AS subcity,
      wor.woreda_name AS woreda
    FROM "Incident" i
    LEFT JOIN addis_woredas wor ON ST_Contains(wor.geom, i.location)
    LEFT JOIN addis_subcities sub ON ST_Contains(sub.geom, i.location)
    WHERE i.id = ${id}
    LIMIT 1
  `);
  res.json(context[0] || null);
});

// Incidents with geometry for maps
router.get(
  "/incidents",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (_req, res) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, title, category, "severityScore",
             ST_Y(location) AS lat,
             ST_X(location) AS lon
      FROM "Incident"
      WHERE location IS NOT NULL
    `);
    res.json(rows);
  }
);

// Admin: list agency jurisdictions
router.get(
  "/admin/agency-jurisdictions",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const rows = await prisma.agencyJurisdiction.findMany({
      include: { agency: true },
    });
    res.json(rows);
  }
);

export default router;
