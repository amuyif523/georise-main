import { Router } from 'express';
import { Role, ResponderStatus } from '@prisma/client';
import prisma from '../../prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import logger from '../../logger';

const router = Router();

const appendBreadcrumbPoint = (existing: unknown, lng: number, lat: number) => {
  const current = Array.isArray(existing) ? [...existing] : [];
  current.push([lng, lat, Date.now()]);
  return current.slice(-500);
};

async function auditResponder(actorId: number, action: string, targetId: number, note?: string) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetType: 'Responder', targetId, note },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write responder audit log');
  }
}

// List responders (admin sees all, agency sees own) with pagination/search
router.get(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    try {
      const user = req.user!;
      const where: Record<string, unknown> = {};

      if (user.role === Role.AGENCY_STAFF || user.role === Role.AGENCY_MANAGER) {
        const staff = await prisma.agencyStaff.findUnique({ where: { userId: user.id } });
        // Instead of hard-failing (403) for e.g. supervisors without linked agencyStaff yet:
        // just return empty if they attempt to list responders but have no agency context.
        if (!staff || !staff.agencyId) {
          return res.json({ total: 0, page: 1, limit: 100, responders: [] });
        }
        where.agencyId = staff.agencyId;
      }

      // Globally exclude soft-deleted/deactivated responders
      where.isActive = true;

      // Ensure no corrupted/null coordinates are transmitted to clients
      where.latitude = { not: null };
      where.longitude = { not: null };

      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const skip = (page - 1) * limit;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const [total, responders] = await Promise.all([
        prisma.responder.count({ where }),
        prisma.responder.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            agency: true,
            incident: true,
            user: { select: { id: true, fullName: true, email: true, isActive: true } },
          },
        }),
      ]);

      const formattedResponders = responders.map((r) => ({
        ...r,
        latitude: r.latitude !== null ? parseFloat(r.latitude as any) : null,
        longitude: r.longitude !== null ? parseFloat(r.longitude as any) : null,
      }));

      res.json({ total, page, limit, responders: formattedResponders });
    } catch (err: any) {
      console.error('Responder fetch error:', err);
      logger.error({ err }, 'List responders error');
      res.status(400).json({ message: 'Failed to list responders' });
    }
  },
);

// Create responder (admin or agency staff)
router.post(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    try {
      const { name, type, agencyId, userId } = req.body;
      if (!name || !type || !agencyId)
        return res.status(400).json({ message: 'name, type, agencyId required' });

      // If userId provided, ensure it exists and isn't already a responder
      if (userId) {
        const existing = await prisma.responder.findFirst({ where: { userId: Number(userId) } });
        if (existing)
          return res.status(400).json({ message: 'User is already linked to a responder' });
      }

      const agency = await prisma.agency.findUnique({
        where: { id: Number(agencyId) },
        select: { centerLatitude: true, centerLongitude: true },
      });
      if (!agency) return res.status(404).json({ message: 'Target agency not found' });

      const created = await prisma.responder.create({
        data: {
          name,
          type,
          agencyId: Number(agencyId),
          userId: userId ? Number(userId) : null,
          latitude: agency.centerLatitude,
          longitude: agency.centerLongitude,
          // @ts-ignore
          breadcrumbs: [[agency.centerLongitude, agency.centerLatitude]],
        },
      });
      await auditResponder(req.user!.id, 'CREATE_RESPONDER', created.id);
      res.status(201).json(created);
    } catch (err: any) {
      logger.error({ err }, 'Create responder error');
      res.status(400).json({ message: err?.message || 'Failed to create responder' });
    }
  },
);

// Update responder (name/type/status/user linkage)
router.patch(
  '/:id',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    try {
      const responderId = Number(req.params.id);
      const { name, type, status, userId, latitude, longitude } = req.body;
      const data: any = {};
      if (name) data.name = name;
      if (type) data.type = type;
      if (status) data.status = status;
      if (userId !== undefined) data.userId = userId ? Number(userId) : null;
      if (latitude !== undefined) data.latitude = Number(latitude);
      if (longitude !== undefined) data.longitude = Number(longitude);

      // Enforce agency scoping for staff
      if (req.user!.role === Role.AGENCY_STAFF || req.user!.role === Role.AGENCY_MANAGER) {
        const staff = await prisma.agencyStaff.findUnique({ where: { userId: req.user!.id } });
        if (!staff) return res.status(403).json({ message: 'No agency context' });
        const target = await prisma.responder.findUnique({ where: { id: responderId } });
        if (!target || target.agencyId !== staff.agencyId)
          return res.status(403).json({ message: 'Forbidden' });
      }

      const updated = await prisma.responder.update({
        where: { id: responderId },
        data,
      });
      await auditResponder(req.user!.id, 'UPDATE_RESPONDER', responderId);
      res.json(updated);
    } catch (err: any) {
      logger.error({ err }, 'Update responder error');
      res.status(400).json({ message: 'Failed to update responder' });
    }
  },
);

// Deactivate responder (soft: mark OFFLINE and clear incident)
router.delete(
  '/:id',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF, Role.AGENCY_MANAGER]),
  async (req: any, res) => {
    try {
      const responderId = Number(req.params.id);
      const current = await prisma.responder.findUnique({ where: { id: responderId } });
      if (!current) return res.status(404).json({ message: 'Responder not found' });
      if (current.incidentId) {
        return res
          .status(400)
          .json({ message: 'Responder has an active assignment; unassign first.' });
      }
      const data = {
        isActive: false,
        deletedAt: new Date(),
        status: 'OFFLINE' as any,
        incidentId: null,
      };

      if (req.user!.role === Role.AGENCY_STAFF || req.user!.role === Role.AGENCY_MANAGER) {
        const staff = await prisma.agencyStaff.findUnique({ where: { userId: req.user!.id } });
        if (!staff) return res.status(403).json({ message: 'No agency context' });
        if (!current || current.agencyId !== staff.agencyId)
          return res.status(403).json({ message: 'Forbidden' });
      }

      const updated = await prisma.responder.update({
        where: { id: responderId },
        data,
      });
      await auditResponder(req.user!.id, 'DEACTIVATE_RESPONDER', responderId);
      res.json({ message: 'Responder deactivated (soft delete)', responder: updated });
    } catch (err: any) {
      logger.error({ err }, 'Deactivate responder error');
      res.status(400).json({ message: 'Failed to deactivate responder' });
    }
  },
);

router.patch('/me/status', requireAuth, async (req: any, res) => {
  try {
    const { status } = req.body as { status?: ResponderStatus };
    if (!status || !Object.values(ResponderStatus).includes(status)) {
      return res.status(400).json({ message: 'Valid responder status is required' });
    }

    const responder = await prisma.responder.findFirst({
      where: { userId: req.user!.id, isActive: true, deletedAt: null },
    });
    if (!responder) {
      return res.status(404).json({ message: 'Responder profile not found' });
    }

    const updated = await prisma.responder.update({
      where: { id: responder.id },
      data: { status, lastSeenAt: new Date() },
    });

    await auditResponder(req.user!.id, 'UPDATE_RESPONDER_STATUS_SELF', responder.id, status);
    return res.json({ responder: updated });
  } catch (err: any) {
    logger.error({ err }, 'Update own responder status error');
    return res.status(400).json({ message: 'Failed to update responder status' });
  }
});

router.patch('/me/location', requireAuth, async (req: any, res) => {
  try {
    const { latitude, longitude, status } = req.body as {
      latitude?: number;
      longitude?: number;
      status?: ResponderStatus;
    };

    if (
      latitude === undefined ||
      longitude === undefined ||
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' });
    }

    if (status && !Object.values(ResponderStatus).includes(status)) {
      return res.status(400).json({ message: 'Invalid responder status' });
    }

    const responder = await prisma.responder.findFirst({
      where: { userId: req.user!.id, isActive: true, deletedAt: null },
      select: { id: true, breadcrumbs: true },
    });

    if (!responder) {
      return res.status(404).json({ message: 'Responder profile not found' });
    }

    const updated = await prisma.responder.update({
      where: { id: responder.id },
      data: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        lastSeenAt: new Date(),
        ...(status ? { status } : {}),
        breadcrumbs: appendBreadcrumbPoint(
          responder.breadcrumbs,
          Number(longitude),
          Number(latitude),
        ),
      },
    });

    return res.json({ responder: updated });
  } catch (err: any) {
    logger.error({ err }, 'Update own responder location error');
    return res.status(400).json({ message: 'Failed to update responder location' });
  }
});

export default router;
