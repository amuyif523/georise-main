import { Router } from "express";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";

const router = Router();

router.get(
  "/subcities",
  requireAuth,
  requireRole(["ADMIN", "AGENCY_STAFF"]),
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

export default router;
