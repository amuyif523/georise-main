import { Router } from 'express';
import { AgencyType, IncidentStatus, ResponderStatus, Role, StaffRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../../middleware/auth';
import prisma from '../../prisma';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate';
import * as systemController from './system.controller';
import { metrics } from '../../metrics/metrics.service';
import rateLimit from 'express-rate-limit';

const router = Router();
const idSchema = z.object({
  id: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().positive()),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
});

const agencyPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive', 'pending']).optional(),
  type: z.nativeEnum(AgencyType).optional(),
});

const userCrudLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

async function auditUser(actorId: number, action: string, targetId: number, note?: string) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetType: 'User', targetId, note },
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

async function auditAgency(actorId: number, action: string, agencyId: number, note?: string) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetType: 'Agency', targetId: agencyId, note },
    });
  } catch (err) {
    console.error('Failed to write agency audit log', err);
  }
}

async function assertAgencyCanDeactivate(agencyId: number) {
  const [activeIncidents, activeResponders] = await Promise.all([
    prisma.incident.count({
      where: {
        assignedAgencyId: agencyId,
        status: {
          in: [
            IncidentStatus.RECEIVED,
            IncidentStatus.UNDER_REVIEW,
            IncidentStatus.ASSIGNED,
            IncidentStatus.RESPONDING,
          ],
        },
      },
    }),
    prisma.responder.count({
      where: {
        agencyId,
        status: { notIn: [ResponderStatus.OFFLINE] },
      },
    }),
  ]);
  if (activeIncidents > 0 || activeResponders > 0) {
    const reason = {
      activeIncidents,
      activeResponders,
    };
    throw new Error(
      `Agency has active assignments (incidents: ${activeIncidents}, responders: ${activeResponders}). Deactivate or reassign before proceeding.`,
    );
  }
}

async function assertUserCanDeactivate(userId: number) {
  const activeResponder = await prisma.responder.findFirst({
    where: {
      userId,
      status: { notIn: [ResponderStatus.OFFLINE] },
    },
    select: { id: true, status: true },
  });
  if (activeResponder) {
    throw new Error(
      'User is assigned as an active responder. Reassign or set responder offline first.',
    );
  }
}

// Pending agencies
router.get('/agencies/pending', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const agencies = await prisma.agency.findMany({
    where: { isApproved: false },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ agencies });
});

// List all agencies
router.get('/agencies', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = agencyPaginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' });
  const { page, limit, search, status, type } = parsed.data;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (status === 'active') {
    where.isActive = true;
    where.isApproved = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  } else if (status === 'pending') {
    where.isApproved = false;
  }
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, agencies] = await Promise.all([
    prisma.agency.count({ where }),
    prisma.agency.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        description: true,
        isApproved: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const agencyIds = agencies.map((a) => a.id);
  const [responderGroups, incidentGroups] = await Promise.all([
    agencyIds.length
      ? prisma.responder.groupBy({
          by: ['agencyId', 'status'],
          _count: { _all: true },
          where: { agencyId: { in: agencyIds } },
        })
      : [],
    agencyIds.length
      ? prisma.incident.groupBy({
          by: ['assignedAgencyId'],
          _count: { _all: true },
          where: {
            assignedAgencyId: { in: agencyIds },
            status: {
              in: [
                IncidentStatus.RECEIVED,
                IncidentStatus.UNDER_REVIEW,
                IncidentStatus.ASSIGNED,
                IncidentStatus.RESPONDING,
              ],
            },
          },
        })
      : [],
  ]);

  const responderStats = new Map<number, Record<string, number>>();
  responderGroups.forEach((row) => {
    const map = responderStats.get(row.agencyId) ?? {};
    map[row.status] = row._count._all;
    responderStats.set(row.agencyId, map);
  });
  const incidentStats = new Map<number, number>();
  incidentGroups.forEach((row) => {
    if (row.assignedAgencyId !== null) {
      incidentStats.set(row.assignedAgencyId, row._count._all);
    }
  });

  const withStats = agencies.map((a) => {
    const stats = responderStats.get(a.id) || {};
    const activeResponders =
      (stats[ResponderStatus.AVAILABLE] || 0) +
      (stats[ResponderStatus.ASSIGNED] || 0) +
      (stats[ResponderStatus.EN_ROUTE] || 0) +
      (stats[ResponderStatus.ON_SCENE] || 0);
    return {
      ...a,
      responderStats: {
        available: stats[ResponderStatus.AVAILABLE] || 0,
        assigned: stats[ResponderStatus.ASSIGNED] || 0,
        enRoute: stats[ResponderStatus.EN_ROUTE] || 0,
        onScene: stats[ResponderStatus.ON_SCENE] || 0,
        offline: stats[ResponderStatus.OFFLINE] || 0,
        active: activeResponders,
      },
      activeIncidentCount: incidentStats.get(a.id) || 0,
    };
  });

  res.json({ total, page: Number(page), limit: Number(limit), agencies: withStats });
});

// Get agency details with boundary
router.get('/agencies/:id', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
  const agencyId = parsed.data.id;

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) return res.status(404).json({ message: 'Agency not found' });

  // Fetch boundary as GeoJSON
  const boundaryResult: any[] = await prisma.$queryRaw`
      SELECT ST_AsGeoJSON(jurisdiction) as geojson
      FROM "Agency"
      WHERE id = ${agencyId}
    `;

  const geojson = boundaryResult[0]?.geojson ? JSON.parse(boundaryResult[0].geojson) : null;

  const responderCounts = await prisma.responder.groupBy({
    by: ['agencyId', 'status'],
    _count: { _all: true },
    where: { agencyId },
  });
  const stats = responderCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const activeIncidents = await prisma.incident.count({
    where: {
      assignedAgencyId: agencyId,
      status: {
        in: [
          IncidentStatus.RECEIVED,
          IncidentStatus.UNDER_REVIEW,
          IncidentStatus.ASSIGNED,
          IncidentStatus.RESPONDING,
        ],
      },
    },
  });

  res.json({
    agency: {
      ...agency,
      boundary: geojson,
      responderStats: {
        available: stats[ResponderStatus.AVAILABLE] || 0,
        assigned: stats[ResponderStatus.ASSIGNED] || 0,
        enRoute: stats[ResponderStatus.EN_ROUTE] || 0,
        onScene: stats[ResponderStatus.ON_SCENE] || 0,
        offline: stats[ResponderStatus.OFFLINE] || 0,
        active:
          (stats[ResponderStatus.AVAILABLE] || 0) +
          (stats[ResponderStatus.ASSIGNED] || 0) +
          (stats[ResponderStatus.EN_ROUTE] || 0) +
          (stats[ResponderStatus.ON_SCENE] || 0),
      },
      activeIncidentCount: activeIncidents,
    },
  });
});

const createAgencySchema = z.object({
  name: z.string().min(3),
  type: z.nativeEnum(AgencyType),
  city: z.string().min(2),
  description: z.string().optional(),
  isApproved: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/agencies',
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(createAgencySchema),
  async (req, res) => {
    const data = req.body as z.infer<typeof createAgencySchema>;
    const agency = await prisma.agency.create({
      data: {
        name: data.name,
        type: data.type,
        city: data.city,
        description: data.description,
        isApproved: data.isApproved ?? false,
        isActive: data.isActive ?? false,
      },
    });
    await auditAgency(req.user!.id, 'CREATE_AGENCY', agency.id);
    res.status(201).json({ agency });
  },
);

const updateAgencySchema = z.object({
  name: z.string().min(3).optional(),
  type: z.nativeEnum(AgencyType).optional(),
  city: z.string().min(2).optional(),
  description: z.string().optional(),
  isApproved: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  '/agencies/:id',
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(updateAgencySchema),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
    const agencyId = parsed.data.id;
    const body = req.body as z.infer<typeof updateAgencySchema>;

    if (body.isActive === false) {
      try {
        await assertAgencyCanDeactivate(agencyId);
      } catch (err: any) {
        return res.status(409).json({ message: err.message });
      }
    }

    const agency = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        ...body,
      },
    });
    await auditAgency(req.user!.id, 'UPDATE_AGENCY', agencyId);
    res.json({ agency });
  },
);

// Approve agency
router.patch('/agencies/:id/approve', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
  const agencyId = parsed.data.id;
  const agency = await prisma.agency.update({
    where: { id: agencyId },
    data: { isApproved: true, isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: 'APPROVE_AGENCY',
      targetType: 'Agency',
      targetId: agencyId,
    },
  });

  res.json({ agency });
});

router.delete('/agencies/:id', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
  const agencyId = parsed.data.id;
  try {
    await assertAgencyCanDeactivate(agencyId);
  } catch (err: any) {
    return res.status(409).json({ message: err.message });
  }

  const agency = await prisma.agency.update({
    where: { id: agencyId },
    data: { isActive: false },
  });
  await auditAgency(req.user!.id, 'DEACTIVATE_AGENCY', agencyId);
  res.json({ agency, message: 'Agency deactivated (deletion guarded by policy).' });
});

// Update boundary with GeoJSON polygon
router.patch(
  '/agencies/:id/boundary',
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(z.object({ geojson: z.string().min(10) })),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
    const agencyId = parsed.data.id;
    const { geojson } = req.body as { geojson: string };

    await prisma.$executeRaw`
      UPDATE "Agency"
      SET jurisdiction = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)
      WHERE id = ${agencyId};
    `;

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'UPDATE_BOUNDARY',
        targetType: 'Agency',
        targetId: agencyId,
      },
    });

    res.json({ success: true });
  },
);

// List users (paginated/searchable)
router.get('/users', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query' });
  const { page, limit, search, role, staffRole, status } = parsed.data;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (role) where.role = role;
  if (status === 'active') {
    where.isActive = true;
    where.deactivatedAt = null;
  } else if (status === 'inactive') {
    where.isActive = false;
  }
  if (staffRole) {
    where.role = role ?? Role.AGENCY_STAFF;
    where.agencyStaff = { staffRole };
  }
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        deactivatedAt: true,
        createdAt: true,
        citizenVerification: { select: { status: true } },
        agencyStaff: {
          select: {
            agencyId: true,
            staffRole: true,
            isActive: true,
            deactivatedAt: true,
          },
        },
      },
    }),
  ]);
  res.json({ total, page: Number(page), limit: Number(limit), users });
});

const createUserSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  agencyId: z.number().optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/users',
  requireAuth,
  requireRole([Role.ADMIN]),
  userCrudLimiter,
  validateBody(createUserSchema),
  async (req: any, res) => {
    try {
      const data = req.body as z.infer<typeof createUserSchema>;
      if (data.role === Role.AGENCY_STAFF && !data.agencyId) {
        return res.status(400).json({ message: 'agencyId required for agency staff' });
      }
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          passwordHash,
          isActive: data.isActive ?? true,
          deactivatedAt: data.isActive === false ? new Date() : null,
        },
      });
      if (data.role === Role.AGENCY_STAFF && data.agencyId) {
        await prisma.agencyStaff.create({
          data: {
            userId: user.id,
            agencyId: data.agencyId,
            staffRole: data.staffRole ?? StaffRole.DISPATCHER,
            isActive: data.isActive ?? true,
            deactivatedAt: data.isActive === false ? new Date() : null,
          },
        });
      }
      await auditUser(req.user!.id, 'CREATE_USER', user.id);
      res.status(201).json({
        user: {
          ...user,
          tempPassword,
          staffRole: data.staffRole ?? StaffRole.DISPATCHER,
          agencyId: data.agencyId,
        },
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Failed to create user' });
    }
  },
);

const updateUserSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  agencyId: z.number().optional(),
  isActive: z.boolean().optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
});

router.patch(
  '/users/:id',
  requireAuth,
  requireRole([Role.ADMIN]),
  userCrudLimiter,
  validateBody(updateUserSchema),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const userId = parsed.data.id;
    const body = req.body as z.infer<typeof updateUserSchema>;
    try {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        include: { agencyStaff: true },
      });
      if (!current) return res.status(404).json({ message: 'User not found' });

      const nextRole = body.role ?? current.role;
      const targetAgencyId = body.agencyId ?? current.agencyStaff?.agencyId ?? null;
      if (nextRole === Role.AGENCY_STAFF && !targetAgencyId) {
        return res.status(400).json({ message: 'agencyId required for agency staff' });
      }
      if (body.staffRole && nextRole !== Role.AGENCY_STAFF) {
        return res.status(400).json({ message: 'staffRole only valid for agency staff' });
      }

      const updates: any = {};
      if (body.fullName) updates.fullName = body.fullName;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.role) updates.role = body.role;
      if (body.isActive !== undefined) {
        if (body.isActive === false) {
          try {
            await assertUserCanDeactivate(userId);
          } catch (err: any) {
            return res.status(409).json({ message: err.message });
          }
        }
        updates.isActive = body.isActive;
        updates.deactivatedAt = body.isActive ? null : new Date();
        if (body.isActive === false) {
          updates.tokenVersion = { increment: 1 };
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updates,
      });

      if (nextRole === Role.AGENCY_STAFF) {
        const payload: any = {
          agencyId: targetAgencyId!,
        };
        if (body.staffRole) payload.staffRole = body.staffRole;
        if (body.isActive !== undefined) {
          payload.isActive = body.isActive;
          payload.deactivatedAt = body.isActive ? null : new Date();
        }
        const existing = await prisma.agencyStaff.findUnique({ where: { userId } });
        if (existing) {
          await prisma.agencyStaff.update({
            where: { userId },
            data: payload,
          });
        } else {
          await prisma.agencyStaff.create({
            data: {
              ...payload,
              userId,
              staffRole: payload.staffRole ?? StaffRole.DISPATCHER,
              isActive: payload.isActive ?? true,
              deactivatedAt: payload.deactivatedAt ?? null,
            },
          });
        }
      } else {
        await prisma.agencyStaff.deleteMany({ where: { userId } });
      }

      await auditUser(req.user!.id, 'UPDATE_USER', user.id);
      res.json({ user });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Failed to update user' });
    }
  },
);

router.post(
  '/users/:id/force-reset',
  requireAuth,
  requireRole([Role.ADMIN]),
  userCrudLimiter,
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const userId = parsed.data.id;
    try {
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await auditUser(req.user!.id, 'FORCE_RESET_PASSWORD', user.id);
      res.json({ userId: user.id, tempPassword });
    } catch (err: any) {
      res.status(400).json({ message: 'Failed to reset password' });
    }
  },
);

// --- Agency-admin scoped user management (AGENCY_STAFF only) ---
const agencyUserCreateSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
  isActive: z.boolean().optional(),
});

const agencyUserUpdateSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  staffRole: z.nativeEnum(StaffRole).optional(),
});

router.get(
  '/agency/users',
  requireAuth,
  requireRole([Role.AGENCY_STAFF]),
  async (req: any, res) => {
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user!.id },
      select: { agencyId: true },
    });
    if (!staff) return res.status(403).json({ message: 'No agency context' });
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid query' });
    const { page, limit, search, status, staffRole } = parsed.data;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      role: Role.AGENCY_STAFF,
      agencyStaff: { agencyId: staff.agencyId, ...(staffRole ? { staffRole } : {}) },
    };
    if (status === 'active') {
      where.isActive = true;
      where.deactivatedAt = null;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          deactivatedAt: true,
          createdAt: true,
          agencyStaff: { select: { staffRole: true, isActive: true, deactivatedAt: true } },
        },
      }),
    ]);
    res.json({ total, page: Number(page), limit: Number(limit), users });
  },
);

router.post(
  '/agency/users',
  requireAuth,
  requireRole([Role.AGENCY_STAFF]),
  userCrudLimiter,
  validateBody(agencyUserCreateSchema),
  async (req: any, res) => {
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user!.id },
      select: { agencyId: true },
    });
    if (!staff) return res.status(403).json({ message: 'No agency context' });
    try {
      const data = req.body as z.infer<typeof agencyUserCreateSchema>;
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: Role.AGENCY_STAFF,
          passwordHash,
          isActive: data.isActive ?? true,
          deactivatedAt: data.isActive === false ? new Date() : null,
        },
      });
      await prisma.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId: staff.agencyId,
          staffRole: data.staffRole ?? StaffRole.DISPATCHER,
          isActive: data.isActive ?? true,
          deactivatedAt: data.isActive === false ? new Date() : null,
        },
      });
      await auditUser(req.user!.id, 'AGENCY_CREATE_USER', user.id);
      res.status(201).json({ user: { ...user, tempPassword } });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'Failed to create agency user' });
    }
  },
);

router.patch(
  '/agency/users/:id',
  requireAuth,
  requireRole([Role.AGENCY_STAFF]),
  userCrudLimiter,
  validateBody(agencyUserUpdateSchema),
  async (req: any, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const targetId = parsed.data.id;
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user!.id },
      select: { agencyId: true },
    });
    if (!staff) return res.status(403).json({ message: 'No agency context' });
    const target = await prisma.agencyStaff.findUnique({ where: { userId: targetId } });
    if (!target || target.agencyId !== staff.agencyId)
      return res.status(403).json({ message: 'Forbidden' });

    const body = req.body as z.infer<typeof agencyUserUpdateSchema>;
    const updates: any = {};
    if (body.fullName) updates.fullName = body.fullName;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.isActive !== undefined) {
      if (body.isActive === false) {
        try {
          await assertUserCanDeactivate(targetId);
        } catch (err: any) {
          return res.status(409).json({ message: err.message });
        }
      }
      updates.isActive = body.isActive;
      updates.deactivatedAt = body.isActive ? null : new Date();
      if (body.isActive === false) {
        updates.tokenVersion = { increment: 1 };
      }
    }

    const user = await prisma.user.update({ where: { id: targetId }, data: updates });
    const staffUpdate: any = {};
    if (body.staffRole) staffUpdate.staffRole = body.staffRole;
    if (body.isActive !== undefined) {
      staffUpdate.isActive = body.isActive;
      staffUpdate.deactivatedAt = body.isActive ? null : new Date();
    }
    if (Object.keys(staffUpdate).length > 0) {
      await prisma.agencyStaff.update({ where: { userId: targetId }, data: staffUpdate });
    }
    await auditUser(req.user!.id, 'AGENCY_UPDATE_USER', user.id);
    res.json({ user });
  },
);

router.post(
  '/agency/users/:id/force-reset',
  requireAuth,
  requireRole([Role.AGENCY_STAFF]),
  userCrudLimiter,
  async (req: any, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const targetId = parsed.data.id;
    const staff = await prisma.agencyStaff.findUnique({
      where: { userId: req.user!.id },
      select: { agencyId: true },
    });
    if (!staff) return res.status(403).json({ message: 'No agency context' });
    const target = await prisma.agencyStaff.findUnique({ where: { userId: targetId } });
    if (!target || target.agencyId !== staff.agencyId)
      return res.status(403).json({ message: 'Forbidden' });

    try {
      const tempPassword = crypto.randomBytes(6).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.update({
        where: { id: targetId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await auditUser(req.user!.id, 'AGENCY_FORCE_RESET_PASSWORD', user.id);
      res.json({ userId: user.id, tempPassword });
    } catch (err: any) {
      res.status(400).json({ message: 'Failed to reset password' });
    }
  },
);

// Verify citizen
router.patch('/users/:id/verify', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
  const userId = parsed.data.id;
  await prisma.citizenVerification.upsert({
    where: { userId },
    update: { status: 'VERIFIED' },
    create: {
      userId,
      nationalId: 'manual',
      phone: 'manual',
      status: 'VERIFIED',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: 'VERIFY_USER',
      targetType: 'User',
      targetId: userId,
    },
  });

  res.json({ success: true });
});

// Audit logs (paginated)
router.get('/audit', requireAuth, requireRole([Role.ADMIN]), async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 50);
  const skip = (page - 1) * pageSize;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);
  res.json({ logs, total, page, pageSize });
});

// Live metrics snapshot (requests/DB/AI latency + error rates)
router.get('/metrics', requireAuth, requireRole([Role.ADMIN]), (_req, res) => {
  res.json({ metrics: metrics.snapshot() });
});

// Analytics
router.get('/analytics', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const total = await prisma.incident.count();
  const active = await prisma.incident.count({
    where: { status: { in: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED', 'RESPONDING'] } },
  });
  const resolved = await prisma.incident.count({
    where: { status: 'RESOLVED' },
  });

  const byAgency = await prisma.incident.groupBy({
    by: ['assignedAgencyId'],
    _count: { _all: true },
  });

  const agencyNames = await prisma.agency.findMany({
    select: { id: true, name: true },
  });
  const nameMap = new Map(agencyNames.map((a) => [a.id, a.name]));

  res.json({
    totals: { total, active, resolved },
    byAgency: byAgency.map((row) => ({
      agencyId: row.assignedAgencyId,
      agencyName: row.assignedAgencyId ? nameMap.get(row.assignedAgencyId) : 'Unassigned',
      count: row._count._all,
    })),
  });
});

// Admin metrics: incidents
router.get('/metrics/incidents', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const total = await prisma.incident.count();
  const active = await prisma.incident.count({
    where: { status: { in: ['RECEIVED', 'UNDER_REVIEW', 'ASSIGNED', 'RESPONDING'] } },
  });
  const resolved = await prisma.incident.count({ where: { status: 'RESOLVED' } });

  const severity = await prisma.incident.aggregate({
    _avg: { severityScore: true },
  });

  const byDay: { day: Date; count: number }[] = await prisma.$queryRawUnsafe(`
      SELECT date_trunc('day', "createdAt") as day, count(*)::int
      FROM "Incident"
      GROUP BY 1
      ORDER BY 1 ASC;
    `);

  res.json({
    total,
    active,
    resolved,
    avgSeverity: severity._avg.severityScore,
    byDay,
  });
});

// Admin metrics: agencies
router.get('/metrics/agencies', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const agencyLoads = await prisma.incident.groupBy({
    by: ['assignedAgencyId', 'status'],
    _count: { _all: true },
  });

  const agencies: any[] = await prisma.$queryRaw`
      SELECT id, name, type, "isActive", "isApproved", city, description, ST_AsGeoJSON(jurisdiction) as boundary
      FROM "Agency"
    `;

  const grouped = agencies.map((a) => {
    const rows = agencyLoads.filter((r) => r.assignedAgencyId === a.id);
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const resolved = rows
      .filter((r) => r.status === 'RESOLVED')
      .reduce((sum, r) => sum + r._count._all, 0);
    return {
      agencyId: a.id,
      name: a.name,
      type: a.type,
      isActive: a.isActive,
      isApproved: a.isApproved,
      city: a.city,
      description: a.description,
      boundary: a.boundary ? JSON.parse(a.boundary) : null,
      total,
      resolved,
    };
  });

  res.json({ agencies: grouped });
});

// Toggle agency active status
router.patch(
  '/agencies/:id/status',
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(z.object({ isActive: z.boolean() })),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid agency id' });
    const agencyId = parsed.data.id;
    const { isActive } = req.body as { isActive: boolean };

    if (isActive === false) {
      try {
        await assertAgencyCanDeactivate(agencyId);
      } catch (err: any) {
        return res.status(409).json({ message: err.message });
      }
    }

    const updated = await prisma.agency.update({
      where: { id: agencyId },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: isActive ? 'ACTIVATE_AGENCY' : 'DEACTIVATE_AGENCY',
        targetType: 'Agency',
        targetId: agencyId,
      },
    });

    res.json({ agency: updated });
  },
);

// Set user active status explicitly
router.patch(
  '/users/:id/status',
  requireAuth,
  requireRole([Role.ADMIN]),
  userCrudLimiter,
  validateBody(z.object({ isActive: z.boolean() })),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const userId = parsed.data.id;
    const { isActive } = req.body as { isActive: boolean };
    if (isActive === false) {
      try {
        await assertUserCanDeactivate(userId);
      } catch (err: any) {
        return res.status(409).json({ message: err.message });
      }
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        tokenVersion: isActive ? undefined : { increment: 1 },
      },
    });
    if (updated.role === Role.AGENCY_STAFF) {
      try {
        await prisma.agencyStaff.update({
          where: { userId },
          data: { isActive, deactivatedAt: isActive ? null : new Date() },
        });
      } catch (err) {
        console.error('Failed to sync agency staff status', err);
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        targetType: 'User',
        targetId: userId,
      },
    });

    res.json({ user: updated });
  },
);

// Toggle shadow ban
router.patch(
  '/users/:id/shadow-ban',
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(z.object({ isShadowBanned: z.boolean() })),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid user id' });
    const userId = parsed.data.id;
    const { isShadowBanned } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isShadowBanned },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'TOGGLE_SHADOW_BAN',
        targetType: 'User',
        targetId: userId,
        note: JSON.stringify({ isShadowBanned }),
      },
    });

    res.json({ user });
  },
);

// Export incidents CSV (basic)
router.get('/export/incidents', requireAuth, requireRole([Role.ADMIN]), async (_req, res) => {
  const incidents = await prisma.incident.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: true,
      severityScore: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      latitude: true,
      longitude: true,
    },
  });

  const header = [
    'id',
    'title',
    'category',
    'severityScore',
    'status',
    'createdAt',
    'updatedAt',
    'latitude',
    'longitude',
  ];
  const rows = incidents.map((i) =>
    [
      i.id,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.category ?? '',
      i.severityScore ?? '',
      i.status,
      i.createdAt.toISOString(),
      i.updatedAt.toISOString(),
      i.latitude ?? '',
      i.longitude ?? '',
    ].join(','),
  );

  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"');
  res.send(csv);
});

// System Config
router.get('/config', requireAuth, requireRole([Role.ADMIN]), systemController.getSystemConfig);
router.patch(
  '/config',
  requireAuth,
  requireRole([Role.ADMIN]),
  systemController.updateSystemConfig,
);
router.post('/broadcast', requireAuth, requireRole([Role.ADMIN]), systemController.sendBroadcast);

export default router;
