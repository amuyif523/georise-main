import { Router } from 'express';
import { Role } from '@prisma/client';
import prisma from '../../prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import logger from '../../logger';

const router = Router();

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
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
  async (req: any, res) => {
    try {
      const user = req.user!;
      const where: Record<string, unknown> = {};

      if (user.role === Role.AGENCY_STAFF) {
        const staff = await prisma.agencyStaff.findUnique({ where: { userId: user.id } });
        if (!staff) return res.status(403).json({ message: 'No agency context' });
        where.agencyId = staff.agencyId;
      }

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
      res.json({ total, page, limit, responders });
    } catch (err: any) {
      logger.error({ err }, 'List responders error');
      res.status(400).json({ message: 'Failed to list responders' });
    }
  },
);

// Create responder (admin or agency staff)
router.post(
  '/',
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
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

      const created = await prisma.responder.create({
        data: {
          name,
          type,
          agencyId: Number(agencyId),
          userId: userId ? Number(userId) : null,
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
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
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
      if (req.user!.role === Role.AGENCY_STAFF) {
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
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
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
      const data = { status: 'OFFLINE' as any, incidentId: null };

      if (req.user!.role === Role.AGENCY_STAFF) {
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
      res.json({ message: 'Responder deactivated', responder: updated });
    } catch (err: any) {
      logger.error({ err }, 'Deactivate responder error');
      res.status(400).json({ message: 'Failed to deactivate responder' });
    }
  },
);

export default router;
