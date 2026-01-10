import { Router } from 'express';
import { IncidentStatus, Role, Prisma, ReviewStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import prisma from '../../prisma';
import {
  createIncident,
  getMyIncidentById,
  getMyIncidents,
  checkDuplicates,
  mergeIncidents,
  shareIncident,
  getIncidentChat,
  postChatMessage,
  uploadIncidentPhoto,
  getIncidentPhotos,
} from './incident.controller';
import { validateBody } from '../../middleware/validate';
import { createIncidentSchema } from './incident.validation';
import { emitIncidentUpdated, toIncidentPayload } from '../../events/incidentEvents';
import { reputationService } from '../reputation/reputation.service';
import { alertService } from '../alert/alert.service';
import { logActivity } from './activity.service';
import { getIO } from '../../socket';
import rateLimit from 'express-rate-limit';
import { pushService } from '../push/push.service';
import { incidentUpload } from '../../middleware/upload';

const router = Router();

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const incidentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Citizen routes
router.post(
  '/',
  incidentLimiter,
  requireAuth,
  requireRole([Role.CITIZEN]),
  validateBody(createIncidentSchema),
  createIncident,
);
router.get('/my', requireAuth, requireRole([Role.CITIZEN]), getMyIncidents);
router.get('/my/:id', requireAuth, requireRole([Role.CITIZEN]), getMyIncidentById);
router.get('/duplicates', requireAuth, checkDuplicates);
router.post('/merge', requireAuth, requireRole([Role.AGENCY_STAFF, Role.ADMIN]), mergeIncidents);
router.post('/:id/photos', requireAuth, incidentUpload.single('photo'), uploadIncidentPhoto);
router.get('/:id/photos', requireAuth, getIncidentPhotos);

// Inter-Agency Coordination
router.get(
  '/resources/agencies',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    const agencies = await prisma.agency.findMany({
      where: { isActive: true, isApproved: true },
      select: { id: true, name: true, type: true },
    });
    res.json({ agencies });
  },
);

router.post(
  '/:incidentId/share',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  shareIncident,
);
router.get(
  '/:incidentId/chat',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  getIncidentChat,
);
router.post(
  '/:incidentId/chat',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  postChatMessage,
);

// Timeline (role-checked)
router.get('/:id/timeline', requireAuth, async (req, res) => {
  const incidentId = Number(req.params.id);
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { reporterId: true, assignedAgencyId: true },
  });
  if (!incident) return res.status(404).json({ message: 'Incident not found' });

  if (req.user?.role === Role.CITIZEN && incident.reporterId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.user?.role === Role.AGENCY_STAFF) {
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user.id },
      select: { agencyId: true },
    });
    if (!staff || incident.assignedAgencyId !== staff.agencyId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const logs = await prisma.activityLog.findMany({
    where: { incidentId },
    orderBy: { createdAt: 'desc' },
  });

  const filtered =
    req.user?.role === Role.CITIZEN
      ? logs.filter((l) => l.type === 'STATUS_CHANGE' || l.type === 'SYSTEM')
      : logs;

  res.json({ logs: filtered });
});

// Comment
router.post(
  '/:id/comment',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const incidentId = Number(req.params.id);
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: 'Message required' });
      await logActivity(incidentId, 'COMMENT', message, req.user!.id);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(400).json({ message: errorMessage(err, 'Failed to add comment') });
    }
  },
);

// Generic status update
router.patch(
  '/:id/status',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const incidentId = Number(req.params.id);
      const { status } = req.body as { status: IncidentStatus };
      if (!status) return res.status(400).json({ message: 'Status required' });
      const updated = await prisma.incident.update({
        where: { id: incidentId },
        data: { status },
      });
      await logActivity(incidentId, 'STATUS_CHANGE', `Status set to ${status}`, req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      await pushService.sendToUsers([updated.reporterId], {
        title: 'Incident update',
        body: `Your report #${updated.id} is now ${updated.status}.`,
        data: { incidentId: updated.id, url: '/citizen/my-reports' },
      });
      res.json({ incident: updated });
    } catch (err: unknown) {
      res.status(400).json({ message: errorMessage(err, 'Failed to update status') });
    }
  },
);

// List/filter for agencies/admins with pagination/search
router.get('/', requireAuth, requireRole([Role.AGENCY_STAFF, Role.ADMIN]), async (req, res) => {
  try {
    let agencyId: number | null = null;
    if (req.user?.role === Role.AGENCY_STAFF) {
      const staff = await prisma.agencyStaff.findUnique({
        where: { userId: req.user.id },
        select: { agencyId: true },
      });
      if (!staff) return res.status(403).json({ message: 'Forbidden' });
      agencyId = staff.agencyId;
    }

    const { status, hours, reviewStatus, search } = req.query;
    const conditions: Prisma.IncidentWhereInput = {};
    if (status && typeof status === 'string') conditions.status = status as IncidentStatus;
    if (reviewStatus && typeof reviewStatus === 'string') {
      conditions.reviewStatus = reviewStatus as ReviewStatus;
    }
    const createdAtFilter =
      hours && Number(hours)
        ? {
            gte: new Date(Date.now() - Number(hours) * 3600 * 1000),
          }
        : undefined;
    if (createdAtFilter) {
      conditions.createdAt = createdAtFilter;
    }
    if (req.query.subCityId) {
      conditions.subCityId = Number(req.query.subCityId);
    }
    if (search && typeof search === 'string') {
      conditions.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (agencyId) {
      // Enforce agency isolation: incidents assigned to OR shared with this agency
      conditions.OR = [{ assignedAgencyId: agencyId }, { sharedWith: { some: { agencyId } } }];
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const baseSelect = {
      id: true,
      title: true,
      category: true,
      severityScore: true,
      status: true,
      latitude: true,
      longitude: true,
      subCityId: true,
      reviewStatus: true,
      createdAt: true,
    };

    if (req.user?.role === Role.ADMIN) {
      const [total, incidents] = await Promise.all([
        prisma.incident.count({ where: conditions }),
        prisma.incident.findMany({
          where: conditions,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            ...baseSelect,
            reporter: {
              select: { id: true, fullName: true, trustScore: true, email: true, phone: true },
            },
          },
        }),
      ]);
      return res.json({ total, page, limit, incidents });
    }

    if (!agencyId) return res.status(403).json({ message: 'Forbidden' });

    const [total, incidents] = await Promise.all([
      prisma.incident.count({ where: conditions }),
      prisma.incident.findMany({
        where: conditions,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: baseSelect,
      }),
    ]);
    res.json({ total, page, limit, incidents });
  } catch (err: unknown) {
    console.error('List incidents error:', err);
    res.status(400).json({ message: errorMessage(err, 'Failed to fetch incidents') });
  }
});

// Nearby search using PostGIS location
router.get(
  '/nearby',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { lat, lng, radius = 1000 } = req.query;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radiusNum = Number(radius);
      const agencyId = req.user?.agencyId;

      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ message: 'lat and lng are required and must be numbers' });
      }
      if (req.user?.role !== Role.ADMIN && !agencyId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const incidents = await prisma.$queryRaw<
        Array<{
          id: number;
          title: string;
          category: string | null;
          severityScore: number | null;
          status: string;
          latitude: number | null;
          longitude: number | null;
          createdAt: Date;
        }>
      >`
        SELECT id, title, category, "severityScore", status, latitude, longitude, "createdAt"
        FROM "Incident" i
        WHERE location IS NOT NULL
          AND ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(${lngNum}, ${latNum}), 4326),
            ${radiusNum}
          )
          AND (
            ${
              req.user?.role === Role.ADMIN
                ? 'TRUE'
                : `i."assignedAgencyId" = ${agencyId} OR EXISTS (
              SELECT 1 FROM "AgencyJurisdiction" aj
              JOIN "SubCity" s ON aj."boundaryId" = s.id AND aj."boundaryType"='SUBCITY'
              WHERE aj."agencyId" = ${agencyId} AND ST_Contains(s.jurisdiction, i.location)
            ) OR EXISTS (
              SELECT 1 FROM "AgencyJurisdiction" aj
              JOIN "Woreda" w ON aj."boundaryId" = w.id AND aj."boundaryType"='WOREDA'
              WHERE aj."agencyId" = ${agencyId} AND ST_Contains(w.boundary, i.location)
            )`
            }
          )
        ORDER BY "severityScore" DESC NULLS LAST, "createdAt" DESC
      `;

      res.json({ incidents });
    } catch (err: unknown) {
      console.error('Nearby incidents error:', err);
      res.status(400).json({ message: errorMessage(err, 'Failed to fetch nearby incidents') });
    }
  },
);

// Assign/respond/resolve workflow for agencies
router.patch(
  '/:id/assign',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.ASSIGNED,
          assignedAgencyId: req.body.assignedAgencyId ?? null,
        },
      });

      await logActivity(
        updated.id,
        'ASSIGNMENT',
        `Assigned to agency ${updated.assignedAgencyId ?? 'N/A'}`,
        req.user!.id,
      );
      if (updated.assignedAgencyId) {
        const io = getIO();
        io.to(`agency:${updated.assignedAgencyId}`).emit(
          'incident:assigned',
          toIncidentPayload(updated),
        );
      }
      emitIncidentUpdated(toIncidentPayload(updated));
      await pushService.sendToUsers([updated.reporterId], {
        title: 'Incident assigned',
        body: `Responders have been assigned to report #${updated.id}.`,
        data: { incidentId: updated.id, url: '/citizen/my-reports' },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'ASSIGN_INCIDENT',
          targetType: 'Incident',
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: unknown) {
      console.error('Assign incident error:', err);
      res.status(400).json({ message: errorMessage(err, 'Failed to assign incident') });
    }
  },
);

router.patch(
  '/:id/respond',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.RESPONDING,
        },
      });

      await logActivity(updated.id, 'STATUS_CHANGE', 'Status set to RESPONDING', req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      await pushService.sendToUsers([updated.reporterId], {
        title: 'Responder en route',
        body: `Responders are en route for report #${updated.id}.`,
        data: { incidentId: updated.id, url: '/citizen/my-reports' },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'RESPOND_INCIDENT',
          targetType: 'Incident',
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: unknown) {
      console.error('Respond incident error:', err);
      res.status(400).json({ message: errorMessage(err, 'Failed to update incident') });
    }
  },
);

router.patch(
  '/:id/resolve',
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.RESOLVED,
        },
      });

      await logActivity(updated.id, 'STATUS_CHANGE', 'Status set to RESOLVED', req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      await pushService.sendToUsers([updated.reporterId], {
        title: 'Incident resolved',
        body: `Your report #${updated.id} has been resolved.`,
        data: { incidentId: updated.id, url: '/citizen/my-reports' },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'RESOLVE_INCIDENT',
          targetType: 'Incident',
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: unknown) {
      console.error('Resolve incident error:', err);
      res.status(400).json({ message: errorMessage(err, 'Failed to resolve incident') });
    }
  },
);

// Review incidents (admin/agency)
router.post(
  '/:id/review',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { decision, note } = req.body as { decision: 'APPROVE' | 'REJECT'; note?: string };
      const incident = await prisma.incident.findUnique({
        where: { id: Number(id) },
        include: { reporter: true },
      });
      if (!incident) return res.status(404).json({ message: 'Incident not found' });

      const reviewStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          reviewStatus,
          reviewedById: req.user!.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });

      if (incident.reporterId) {
        if (decision === 'APPROVE') {
          await reputationService.onIncidentValidated(incident.reporterId);
          // Check for proximity alerts
          await alertService.checkProximityAndAlert(updated.id);
        } else await reputationService.onIncidentRejected(incident.reporterId);
      } else if (decision === 'APPROVE') {
        // Even if no reporter, we should alert if approved
        await alertService.checkProximityAndAlert(updated.id);
      }

      emitIncidentUpdated(toIncidentPayload(updated));
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'REVIEW_INCIDENT',
          targetType: 'Incident',
          targetId: Number(id),
          note: JSON.stringify({ decision, note: note ?? null }),
        },
      });
      return res.json({ incident: updated });
    } catch (err: unknown) {
      console.error('Review incident error:', err);
      res.status(400).json({ message: errorMessage(err, 'Failed to review incident') });
    }
  },
);

export default router;
