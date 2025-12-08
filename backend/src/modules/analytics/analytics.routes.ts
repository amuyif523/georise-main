import { Router } from "express";
import prisma from "../../prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { Role } from "@prisma/client";

const router = Router();

// Heatmap points (lat/lng/severity)
router.get("/heatmap", requireAuth, async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      ST_Y(location) AS lat,
      ST_X(location) AS lng,
      COALESCE("severityScore", 0) AS severity
    FROM "Incident"
    WHERE location IS NOT NULL
      AND "status" != 'CANCELLED'
  `);
  res.json(rows);
});

// K-means clustering (default k=5) for last 30 days
router.get("/clusters", requireAuth, async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      ST_ClusterKMeans(location, 5) OVER () AS cluster_id,
      id,
      title,
      COALESCE("severityScore", 0) AS severity,
      ST_Y(location) AS lat,
      ST_X(location) AS lng
    FROM "Incident"
    WHERE location IS NOT NULL
      AND "reportedAt" > NOW() - INTERVAL '30 days'
  `);
  res.json(rows);
});

// KPI cards: avg dispatch/arrival/resolution rate
router.get("/kpi", requireAuth, async (_req, res) => {
  const [row] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      (SELECT AVG(EXTRACT(EPOCH FROM ("dispatchedAt" - "reportedAt")))/60 FROM "Incident" WHERE "dispatchedAt" IS NOT NULL) AS avg_dispatch,
      (SELECT AVG(EXTRACT(EPOCH FROM ("arrivalAt" - "dispatchedAt")))/60 FROM "Incident" WHERE "arrivalAt" IS NOT NULL AND "dispatchedAt" IS NOT NULL) AS avg_arrival,
      (SELECT COUNT(*) FILTER (WHERE status='RESOLVED')*100.0/NULLIF(COUNT(*),0) FROM "Incident") AS resolution_rate
  `);

  res.json({
    avgDispatch: row?.avg_dispatch !== null ? Number(row.avg_dispatch.toFixed(1)) : null,
    avgArrival: row?.avg_arrival !== null ? Number(row.avg_arrival.toFixed(1)) : null,
    resolutionRate: row?.resolution_rate !== null ? Number(row.resolution_rate.toFixed(1)) : null,
  });
});

// Time-series incidents per day (last 30 days)
router.get("/timeline", requireAuth, async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      to_char(date_trunc('day', "reportedAt"), 'YYYY-MM-DD') AS day,
      count(*) AS count
    FROM "Incident"
    WHERE "reportedAt" >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day ASC
  `);
  res.json(rows);
});

// Admin-only endpoint to surface analytics safely if needed
router.get("/admin/summary", requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const [row] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      (SELECT COUNT(*) FROM "Incident") AS total_incidents,
      (SELECT COUNT(*) FROM "Incident" WHERE status='RESOLVED') AS resolved_incidents,
      (SELECT COUNT(*) FROM "Incident" WHERE status!='RESOLVED') AS active_incidents
  `);
  res.json(row || {});
});

export default router;
