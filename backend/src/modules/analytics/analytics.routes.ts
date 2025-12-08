import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import prisma from "../../prisma";

const router = Router();

// Heatmap points with time/severity filters
router.get(
  "/heatmap",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const hours = Number(req.query.hours || 24);
      const minSeverity = Number(req.query.minSeverity || 0);
      const since = new Date(Date.now() - hours * 3600 * 1000);

      const points = await prisma.$queryRaw<
        Array<{ lat: number; lng: number; weight: number | null }>
      >`
        SELECT ST_Y(location) AS lat,
               ST_X(location) AS lng,
               "severityScore"::float AS weight
        FROM "Incident"
        WHERE location IS NOT NULL
          AND "createdAt" >= ${since}
          AND ("severityScore" IS NULL OR "severityScore" >= ${minSeverity})
      `;

      res.json({ points });
    } catch (err: any) {
      console.error("Heatmap error:", err);
      res.status(400).json({ message: err?.message || "Failed to load heatmap points" });
    }
  }
);

// Hotspot clusters (admin)
router.get(
  "/clusters",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    try {
      const clusters = await prisma.$queryRaw<
        Array<{ id: number; lat: number; lng: number; cluster_id: number }>
      >`
        SELECT id,
               ST_Y(location) AS lat,
               ST_X(location) AS lng,
               cluster_id
        FROM (
          SELECT id, location,
            ST_ClusterKMeans(location::geometry, 5) OVER () AS cluster_id
          FROM "Incident"
          WHERE location IS NOT NULL
        ) AS clusters
      `;

      res.json({ clusters });
    } catch (err: any) {
      console.error("Clusters error:", err);
      res.status(400).json({ message: err?.message || "Failed to load clusters" });
    }
  }
);

// Basic stats
router.get(
  "/stats",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    try {
      const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const total = await prisma.incident.count();
      const highSeverity = await prisma.incident.count({
        where: { severityScore: { gte: 4 } },
      });
      const weekIncidents = await prisma.incident.count({
        where: { createdAt: { gte: lastWeek } },
      });
      const perCategory = await prisma.incident.groupBy({
        by: ["category"],
        _count: { _all: true },
      });

      res.json({ total, highSeverity, weekIncidents, perCategory });
    } catch (err: any) {
      console.error("Stats error:", err);
      res.status(400).json({ message: err?.message || "Failed to load stats" });
    }
  }
);

// Simple risk scoring prototype (higher severity + recency)
router.get(
  "/risk",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const hours = Number(req.query.hours || 72);
      const top = Number(req.query.top || 10);

      const risks = await prisma.$queryRaw<
        Array<{
          id: number;
          title: string;
          category: string | null;
          severityScore: number | null;
          status: string;
          latitude: number | null;
          longitude: number | null;
          risk: number;
        }>
      >`
        SELECT id,
               title,
               category,
               "severityScore",
               status,
               latitude,
               longitude,
               (
                 COALESCE("severityScore", 2)
                 + CASE WHEN status != 'RESOLVED' THEN 1 ELSE 0 END
                 + LEAST(1.0, 24.0 / (EXTRACT(EPOCH FROM (NOW() - "createdAt"))/3600.0 + 1))
               ) AS risk
        FROM "Incident"
        WHERE "createdAt" >= NOW() - (${hours} * INTERVAL '1 hour')
          AND location IS NOT NULL
        ORDER BY risk DESC
        LIMIT ${top}
      `;

      res.json({ risks });
    } catch (err: any) {
      console.error("Risk scoring error:", err);
      res.status(400).json({ message: err?.message || "Failed to load risk scores" });
    }
  }
);

export default router;
