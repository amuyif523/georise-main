import bcrypt from 'bcrypt';
import { AgencyType, IncidentStatus, ResponderStatus, Role, StaffRole } from '@prisma/client';
import prisma from '../../src/prisma';

type CreateUserInput = {
  email?: string;
  phone?: string | null;
  password?: string;
  fullName?: string;
  role?: Role;
};

export const createUser = async (input: CreateUserInput = {}) => {
  const password = input.password || 'password123';
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      fullName: input.fullName || 'Test User',
      email: input.email || `user_${Date.now()}@example.com`,
      phone: input.phone ?? null,
      passwordHash,
      role: input.role || Role.CITIZEN,
      trustScore: 100, // High trust for test users to bypass strict verification
    },
  });
};

type CreateAgencyInput = {
  name?: string;
  city?: string;
  type?: AgencyType;
  isApproved?: boolean;
  isActive?: boolean;
  description?: string | null;
};

export const createAgency = async (input: CreateAgencyInput = {}) =>
  prisma.agency.create({
    data: {
      name: input.name || `Agency ${Date.now()}`,
      city: input.city || 'Addis Ababa',
      type: input.type || AgencyType.POLICE,
      description: input.description ?? null,
      isApproved: input.isApproved ?? true,
      isActive: input.isActive ?? true,
    },
  });

export const linkAgencyStaff = async (
  userId: number,
  agencyId: number,
  staffRole: StaffRole = StaffRole.DISPATCHER,
) =>
  prisma.agencyStaff.create({
    data: {
      userId,
      agencyId,
      position: 'Dispatcher',
      staffRole,
    },
  });

type CreateResponderInput = {
  name?: string;
  type?: string;
  status?: ResponderStatus;
  agencyId: number;
  userId?: number | null;
  incidentId?: number | null;
};

export const createResponder = async (input: CreateResponderInput) =>
  prisma.responder.create({
    data: {
      name: input.name ?? `Responder ${Date.now()}`,
      type: input.type ?? 'VEHICLE',
      status: input.status ?? ResponderStatus.AVAILABLE,
      agencyId: input.agencyId,
      userId: input.userId ?? null,
      incidentId: input.incidentId ?? null,
    },
  });

type CreateIncidentInput = {
  reporterId?: number;
  assignedAgencyId?: number | null;
  title?: string;
  description?: string;
  category?: string;
  severityScore?: number;
  latitude?: number;
  longitude?: number;
  status?: IncidentStatus;
};

export const createIncident = async (input: CreateIncidentInput = {}) => {
  const reporterId =
    input.reporterId ??
    (
      await createUser({
        email: `reporter_${Date.now()}@example.com`,
        role: Role.CITIZEN,
      })
    ).id;
  const incident = await prisma.incident.create({
    data: {
      reporterId,
      assignedAgencyId: input.assignedAgencyId ?? null,
      title: input.title || 'Test incident',
      description: input.description || 'Test description for incident',
      category: input.category,
      severityScore: input.severityScore,
      status: input.status || IncidentStatus.RECEIVED,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });

  if (input.latitude != null && input.longitude != null) {
    await prisma.$executeRaw`
      UPDATE "Incident"
      SET location = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)
      WHERE id = ${incident.id};
    `;
  }

  return incident;
};
