import bcrypt from "bcrypt";
import { AgencyType, IncidentStatus, Role } from "@prisma/client";
import prisma from "../../src/prisma";

type CreateUserInput = {
  email?: string;
  phone?: string | null;
  password?: string;
  fullName?: string;
  role?: Role;
};

export const createUser = async (input: CreateUserInput = {}) => {
  const password = input.password || "password123";
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      fullName: input.fullName || "Test User",
      email: input.email || `user_${Date.now()}@example.com`,
      phone: input.phone ?? null,
      passwordHash,
      role: input.role || Role.CITIZEN,
    },
  });
};

type CreateAgencyInput = {
  name?: string;
  city?: string;
  type?: AgencyType;
};

export const createAgency = async (input: CreateAgencyInput = {}) =>
  prisma.agency.create({
    data: {
      name: input.name || `Agency ${Date.now()}`,
      city: input.city || "Addis Ababa",
      type: input.type || AgencyType.POLICE,
      isApproved: true,
      isActive: true,
    },
  });

export const linkAgencyStaff = async (userId: number, agencyId: number) =>
  prisma.agencyStaff.create({
    data: {
      userId,
      agencyId,
      position: "Dispatcher",
    },
  });

type CreateIncidentInput = {
  reporterId: number;
  title?: string;
  description?: string;
  category?: string;
  severityScore?: number;
  latitude?: number;
  longitude?: number;
  status?: IncidentStatus;
};

export const createIncident = async (input: CreateIncidentInput) => {
  const incident = await prisma.incident.create({
    data: {
      reporterId: input.reporterId,
      title: input.title || "Test incident",
      description: input.description || "Test description for incident",
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
