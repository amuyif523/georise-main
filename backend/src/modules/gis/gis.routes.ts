import { Router } from 'express';
import prisma from '../../prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { Role } from '@prisma/client';
import { routingService } from '../../services/routing.service';

const router = Router();

// getAgencyContext is now mostly replaced by req.user.agencyId, but kept for deep queries if needed
async function getAgencyContext(userId: number) {
  return prisma.agencyStaff.findUnique({
    where: { userId },
    select: { agencyId: true },
  });
}

// Legacy subcity endpoint (kept for compatibility)
router.get(
  '/subcities',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (_req, res) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, code, ST_AsGeoJSON(jurisdiction) AS geojson
      FROM "SubCity"
      WHERE jurisdiction IS NOT NULL;
    `);
    const features = rows.map((r) => ({
      type: 'Feature',
      properties: { id: r.id, name: r.name, code: r.code },
      geometry: r.geojson ? JSON.parse(r.geojson) : null,
    }));
    return res.json({ type: 'FeatureCollection', features });
  },
);

router.get(
  '/boundaries',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    const level = (req.query.level as string) || 'subcity';
    const agencyId =
      req.user?.role === Role.AGENCY_STAFF || req.user?.role === Role.AGENCY_MANAGER
        ? req.user.agencyId
        : null;

    if (level === 'agency') {
      if (agencyId) {
        const rows = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, name, type, ST_AsGeoJSON(boundary) AS boundary
          FROM "Agency"
          WHERE id = ${agencyId}
          LIMIT 1
        `);
        const agency = rows[0];
        if (!agency) return res.status(404).json({ message: 'Agency not found' });
        return res.json(
          agency.boundary
            ? [
                {
                  id: agency.id,
                  name: agency.name,
                  type: agency.type,
                  geometry: JSON.parse(agency.boundary),
                },
              ]
            : [],
        );
      }
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, name, type, ST_AsGeoJSON(boundary) AS geometry
        FROM "Agency"
        WHERE boundary IS NOT NULL
      `);
      return res.json(rows);
    }

    // Relaxed Guard: Allow AGENCY_STAFF to view subcity/woreda for context (visualization only)
    // The specific agency boundary query is handled above.
    // If they ask for 'subcity' or 'woreda', we just let them proceed to the general queries below.

    // if (agencyId) {
    //   return res
    //     .status(403)
    //     .json({ message: 'Agency staff can only access their agency boundary' });
    // }

    if (level === 'woreda') {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, name, subcity_id AS "subCityId", ST_AsGeoJSON(boundary) AS geometry
        FROM "Woreda"
        WHERE boundary IS NOT NULL
      `);
      return res.json(rows);
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, code, ST_AsGeoJSON(jurisdiction) AS geometry
      FROM "SubCity"
      WHERE jurisdiction IS NOT NULL
    `);
    return res.json(rows);
  },
);

router.get(
  '/boundaries/:id/incidents',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    const id = Number(req.params.id);
    const level = (req.query.level as string) || 'subcity';
    const agencyId =
      req.user?.role === Role.AGENCY_STAFF || req.user?.role === Role.AGENCY_MANAGER
        ? req.user.agencyId
        : null;
    if (agencyId) {
      if (level !== 'agency' || id !== agencyId) {
        return res.status(403).json({ message: 'Forbidden for this agency boundary' });
      }
    }

    const table = level === 'woreda' ? '"Woreda"' : '"SubCity"';
    const geomColumn = level === 'woreda' ? 'boundary' : 'jurisdiction';
    const incidents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT i.id, i.title, i.status, i.latitude, i.longitude
    FROM "Incident" i
    JOIN ${table} b
      ON ST_Contains(b.${geomColumn}, i.location)
    WHERE b.id = ${id} ${agencyId ? `AND (i."assignedAgencyId" = ${agencyId} OR i."assignedAgencyId" IS NULL)` : ''}
  `);
    const formatted = incidents.map((i: any) => ({
      ...i,
      latitude: parseFloat(i.latitude),
      longitude: parseFloat(i.longitude),
    }));
    res.json(formatted);
  },
);

router.get(
  '/incident/:id/context',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    const id = Number(req.params.id);
    const staff =
      req.user?.role === Role.AGENCY_STAFF || req.user?.role === Role.AGENCY_MANAGER
        ? await getAgencyContext(req.user.id)
        : null;
    const context = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      i.id,
      i.title,
      sub.name AS subcity,
      wor.name AS woreda
    FROM "Incident" i
    LEFT JOIN "Woreda" wor ON i.location IS NOT NULL AND wor.boundary IS NOT NULL AND ST_Contains(wor.boundary, i.location)
    LEFT JOIN "SubCity" sub ON i.location IS NOT NULL AND sub.jurisdiction IS NOT NULL AND ST_Contains(sub.jurisdiction, i.location)
    WHERE i.id = ${id}
    LIMIT 1
  `);
    const record = context[0] || null;
    if (staff && record) {
      const incident = await prisma.incident.findUnique({
        where: { id },
        select: { assignedAgencyId: true },
      });
      if (incident?.assignedAgencyId && incident.assignedAgencyId !== staff.agencyId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    res.json(record);
  },
);

// Incidents with geometry for maps
router.get(
  '/incidents',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.AGENCY_MANAGER, Role.ADMIN, Role.CITIZEN]),
  async (req: any, res) => {
    const agencyId =
      req.user?.role === Role.AGENCY_STAFF || req.user?.role === Role.AGENCY_MANAGER
        ? req.user.agencyId
        : null;
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, title, category, "severityScore", status,
             ST_Y(location) AS latitude,
             ST_X(location) AS longitude,
             "assignedAgencyId"
      FROM "Incident"
      WHERE location IS NOT NULL
        AND status IN ('RECEIVED', 'ASSIGNED', 'RESPONDING')
    `);
    const scoped = agencyId
      ? rows.filter((r) => r.assignedAgencyId === agencyId || r.assignedAgencyId === null)
      : rows;

    const formatted = scoped.map((r: any) => ({
      ...r,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
    }));

    res.json(formatted);
  },
);

// Admin: list agency jurisdictions
router.get(
  '/admin/agency-jurisdictions',
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const rows = await prisma.agencyJurisdiction.findMany({
      include: { agency: true },
    });
    res.json(rows);
  },
);

router.get(
  '/route',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req, res) => {
    try {
      const { startLat, startLon, endLat, endLon } = req.query;
      if (!startLat || !startLon || !endLat || !endLon) {
        return res.status(400).json({ message: 'Missing coordinates for routing' });
      }

      const route = await routingService.calculateRoute(
        Number(startLat),
        Number(startLon),
        Number(endLat),
        Number(endLon),
      );

      res.json(route);
    } catch (err: any) {
      console.error('Route calculation failed', err);
      res.status(500).json({ message: 'Routing failed' });
    }
  },
);

export default router;
