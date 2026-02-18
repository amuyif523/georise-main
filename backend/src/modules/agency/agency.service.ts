import prisma from '../../prisma';
import bcrypt from 'bcrypt';
import { StaffRole, AgencyType, IncidentStatus, ResponderStatus, Role } from '@prisma/client';
import { smsService } from '../sms/sms.service';

export const agencyService = {
  async getAgencies(filters: {
    page: number;
    limit: number;
    search?: string;
    status?: 'active' | 'inactive' | 'pending' | 'all';
    type?: AgencyType;
  }) {
    const { page, limit, search, status, type } = filters;
    const skip = (page - 1) * limit;

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
      prisma.agency.count({ where: { ...where, deletedAt: null } }),
      prisma.agency.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take: limit,
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

    return { total, agencies: withStats };
  },

  async createAgencyWithAdmin(
    agencyData: {
      name: string;
      type: AgencyType;
      city: string;
      description?: string;
      isApproved?: boolean;
      isActive?: boolean;
    },
    adminData: {
      fullName: string;
      email: string;
      phone?: string;
    },
  ) {
    // 1. Check for existing user to avoid partial transaction failure if possible (optional but good UX)
    // Actually, transaction will handle rollback, so strict check inside or before is fine.
    // Let's check before to give clear error.
    const existing = await prisma.user.findFirst({
      where: { email: adminData.email },
    });
    if (existing) throw new Error(`User with email ${adminData.email} already exists`);

    // 2. Generate Temp Password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 3. Atomic Transaction
    return await prisma.$transaction(async (tx) => {
      // Create Agency
      const agency = await tx.agency.create({
        data: {
          name: agencyData.name,
          type: agencyData.type,
          city: agencyData.city,
          description: agencyData.description,
          isApproved: agencyData.isApproved ?? false,
          isActive: agencyData.isActive ?? false,
        },
      });

      // Create Admin User
      const user = await tx.user.create({
        data: {
          fullName: adminData.fullName,
          email: adminData.email,
          phone: adminData.phone, // Phone might be optional in UI but schema check? Schema says optional string?
          passwordHash,
          role: Role.AGENCY_STAFF, // Use enum
          isActive: true,
        },
      });

      // Link as Supervisor
      await tx.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId: agency.id,
          staffRole: StaffRole.SUPERVISOR,
          isActive: true,
        },
      });

      // Return combined result
      return { agency, user, tempPassword };
    });
  },

  async addStaff(
    agencyId: number,
    data: { fullName: string; email: string; phone: string; staffRole: StaffRole },
  ) {
    // 1. Check if user exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) throw new Error('User with this email or phone already exists');

    // 2. Generate Temp Password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 3. Create User + AgencyStaff + Responder (if applicable)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: 'AGENCY_STAFF',
          isActive: true,
        },
      });

      await tx.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId,
          staffRole: data.staffRole,
        },
      });

      if (data.staffRole === 'RESPONDER') {
        await tx.responder.create({
          data: {
            name: user.fullName,
            agencyId,
            userId: user.id,
            status: 'OFFLINE',
            type: 'General',
          },
        });
      }

      return user;
    });

    try {
      await smsService.sendSMS(
        data.phone,
        `Welcome to GeoRise! You have been added as ${data.staffRole}. Temp Password: ${tempPassword}`,
      );
    } catch (e) {
      console.error('Failed to send welcome SMS:', e);
    }

    return result;
  },

  async getStaff(agencyId: number) {
    return prisma.agencyStaff.findMany({
      where: { agencyId, isActive: true },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
  },
};
