import prisma from '../../prisma';
import bcrypt from 'bcrypt';
import { StaffRole } from '@prisma/client';
import { smsService } from '../sms/sms.service';

export const agencyService = {
  async getAgencies() {
    return prisma.agency.findMany({
      where: {
        isActive: true,
        isApproved: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
      },
      orderBy: { name: 'asc' },
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
