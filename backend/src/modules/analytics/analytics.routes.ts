import { Router } from "express";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { analyticsService } from "./analytics.service";

const router = Router();

const buildFilters = (req: any) => {
  const f: any = {};
  if (req.query.from) f.from = req.query.from;
  if (req.query.to) f.to = req.query.to;
  if (req.query.agencyId) f.agencyId = Number(req.query.agencyId);
  return f;
};

// Admin overview
router.get("/overview/admin", requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const data = await analyticsService.getOverview(buildFilters(req));
    res.json(data);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message || "Failed to load analytics" });
  }
});

// Agency overview (scoped to user's agency)
router.get("/overview/agency", requireAuth, requireRole([Role.AGENCY_STAFF]), async (req: any, res) => {
  try {
    // Derive agencyId from agencyStaff
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user?.id },
    });
    const filters = buildFilters(req);
    const data = await analyticsService.getOverview({ ...filters, agencyId: staff?.agencyId });
    res.json(data);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message || "Failed to load analytics" });
  }
});

// Heatmap points (lat/lng/severity)
router.get("/heatmap", requireAuth, async (req, res) => {
  const rows = await analyticsService.getHeatmapPoints(buildFilters(req));
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
// Legacy KPI/timeline kept for compatibility (admin scoped)
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

export default router;
