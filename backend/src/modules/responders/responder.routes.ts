import { Router } from 'express';
import { Role } from '@prisma/client';
import prisma from '../../prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import logger from '../../logger';

const router = Router();

// List responders (admin sees all, agency sees own)
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const user = req.user!;
    let where: any = {};

    if (user.role === Role.AGENCY_STAFF) {
      const staff = await prisma.agencyStaff.findUnique({ where: { userId: user.id } });
      if (!staff) return res.status(403).json({ message: 'No agency context' });
      where.agencyId = staff.agencyId;
    }

    const responders = await prisma.responder.findMany({
      where,
      include: {
        agency: true,
        incident: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    res.json(responders);
  } catch (err: any) {
    logger.error({ err }, 'List responders error');
    res.status(400).json({ message: 'Failed to list responders' });
  }
});

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
      res.status(201).json(created);
    } catch (err: any) {
      logger.error({ err }, 'Create responder error');
      res.status(400).json({ message: err?.message || 'Failed to create responder' });
    }
  },
);

export default router;
