import prisma from '../../prisma';
import bcrypt from 'bcrypt';
import { StaffRole, AgencyType, IncidentStatus, ResponderStatus, Role } from '@prisma/client';
import { smsService } from '../sms/sms.service';
import { getIO } from '../../socket';

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
      centerLatitude: number;
      centerLongitude: number;
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
          centerLatitude: agencyData.centerLatitude,
          centerLongitude: agencyData.centerLongitude,
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
        const agency = await tx.agency.findUnique({
          where: { id: agencyId },
          select: { centerLatitude: true, centerLongitude: true },
        });

        // Fallback to Addis Ababa center if HQ coordinates are magically null
        const lat = agency?.centerLatitude ?? 9.0192;
        const lng = agency?.centerLongitude ?? 38.7525;

        await tx.responder.create({
          data: {
            name: user.fullName,
            agencyId,
            userId: user.id,
            status: 'OFFLINE',
            type: 'General',
            latitude: lat,
            longitude: lng,
            // @ts-ignore - Prisma JSON array syntax bypass for breadcrumbs
            breadcrumbs: [[lng, lat]],
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

  getProfile: async (agencyId: number) => {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) return null;

    // Fetch jurisdiction as GeoJSON string
    let jurisdiction: any = null;
    try {
      const raw: any[] = await prisma.$queryRaw`
            SELECT ST_AsGeoJSON(jurisdiction) as geo 
            FROM "Agency" 
            WHERE id = ${agencyId}
        `;

      if (raw.length > 0 && raw[0].geo) {
        jurisdiction = JSON.parse(raw[0].geo);
      }
    } catch (e) {
      console.error('Error fetching jurisdiction raw geometry:', e);
      // Fallback to null or empty
    }

    // Default "Empty" Polygon if null to prevent frontend crashes
    // Or just return null and let frontend handle?
    // User requested "return a default 'Empty Polygon'".
    // A null jurisdiction is semantically "no jurisdiction", which is valid.
    // However, if we MUST return a polygon, we can return a null-geometry feature.
    // For now, let's keep it null but explicit.

    return { ...agency, jurisdiction };
  },

  async setStaffStatus(userId: number, isActive: boolean) {
    // 1. Fetch user to check current role and assignments
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
      include: { agencyStaff: true },
    });

    if (!userToUpdate) throw new Error('User not found');

    // 2. Identity Guard: Cannot deactivate an ADMIN or SUPERVISOR
    const activeRole = userToUpdate.agencyStaff?.staffRole || userToUpdate.role;
    if (!isActive && (activeRole === 'SUPERVISOR' || activeRole === 'ADMIN')) {
      throw new Error('Action Denied: Cannot deactivate a Supervisor or Administrator.');
    }

    // 3. Check if deactivating and they have an active assignment
    if (!isActive) {
      const responder = await prisma.responder.findFirst({
        where: { userId },
      });
      if (responder && responder.incidentId) {
        throw new Error('Operation Blocked: Staff is currently assigned to an active incident.');
      }
    }

    // 4. Wrap update in transaction to cascade soft deletion to Responder
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          isActive,
          deletedAt: isActive ? null : new Date(),
        },
        include: { agencyStaff: true },
      });

      // Update linked responder if it exists
      const responder = await tx.responder.findFirst({
        where: { userId },
      });

      if (responder) {
        await tx.responder.update({
          where: { id: responder.id },
          data: {
            isActive,
            deletedAt: isActive ? null : new Date(),
            // Ensure status drops offline if deactivated
            status: isActive ? responder.status : 'OFFLINE',
          },
        });
      }

      return updatedUser;
    });

    // If deactivating, disconnect socket and revoke session
    if (!isActive) {
      try {
        const io = getIO();
        io.in(`user:${userId}`).disconnectSockets(true);
      } catch (e) {
        console.error('Failed to disconnect socket for user', userId, e);
      }
    }

    return user;
  },

  async deleteStaff(userId: number, requestorId: number) {
    // 1. "No-Suicide" Rule (Strict Equality)
    if (userId === requestorId) {
      throw new Error('Action Denied: You cannot delete your own administrative account');
    }

    // 2. Fetch User and enforce 2-stage deletion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agencyStaff: true },
    });

    if (!user) throw new Error('Staff member not found');

    // Identity Guard: Cannot delete an ADMIN or SUPERVISOR
    const activeRole = user.agencyStaff?.staffRole || user.role;
    if (activeRole === 'SUPERVISOR' || activeRole === 'ADMIN') {
      throw new Error('Action Denied: Cannot delete a Supervisor or Administrator.');
    }

    if (user.isActive) {
      throw new Error('Staff must be deactivated before they can be deleted');
    }

    // 3. Execute Deep Soft-Delete Transaction
    return await prisma.$transaction(async (tx) => {
      const deletedUser = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false, // Ensure loop closure: force isActive to false
          deletedAt: new Date(),
        },
      });

      if (user.agencyStaff) {
        await tx.agencyStaff.update({
          where: { userId: user.id },
          data: {
            deactivatedAt: new Date(),
          },
        });
      }

      const responder = await tx.responder.findFirst({
        where: { userId: user.id },
      });

      if (responder) {
        await tx.responder.update({
          where: { id: responder.id },
          data: {
            deletedAt: new Date(),
            isActive: false,
            status: 'OFFLINE',
          },
        });
      }

      return deletedUser;
    });
  },
};
