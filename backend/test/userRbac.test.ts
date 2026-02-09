import { vi, describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';

// Mock Prisma
vi.mock('../src/prisma', () => {
  const db = {
    users: [] as any[],
    agencies: [] as any[],
    agencyStaff: [] as any[],
  };

  return {
    default: {
      user: {
        create: vi.fn().mockImplementation((args) => {
          const newUser = {
            id: Math.floor(Math.random() * 10000) + 1,
            ...args.data
          };
          db.users.push(newUser);
          return Promise.resolve(newUser);
        }),
        findUnique: vi.fn().mockImplementation((args) => {
          const found = db.users.find(u => {
            if (args.where.id) return u.id === args.where.id;
            if (args.where.email) return u.email === args.where.email;
            return false;
          });
          if (found && args.include && args.include.agencyStaff) {
            const staff = db.agencyStaff.find(s => s.userId === found.id);
            return Promise.resolve({ ...found, agencyStaff: staff || null });
          }
          return Promise.resolve(found || null);
        }),
        update: vi.fn().mockImplementation((args) => {
          const idx = db.users.findIndex(u => u.id === args.where.id);
          if (idx !== -1) {
            db.users[idx] = { ...db.users[idx], ...args.data };
            return Promise.resolve(db.users[idx]);
          }
          return Promise.resolve(null);
        }),
      },
      agency: {
        create: vi.fn().mockImplementation((args) => {
          const newAgency = { id: Math.floor(Math.random() * 1000) + 1, ...args.data };
          db.agencies.push(newAgency);
          return Promise.resolve(newAgency);
        }),
      },
      agencyStaff: {
        create: vi.fn().mockImplementation((args) => {
          const newStaff = { id: Math.floor(Math.random() * 1000) + 1, ...args.data };
          db.agencyStaff.push(newStaff);
          return Promise.resolve(newStaff);
        }),
        findUnique: vi.fn().mockImplementation((args) => {
          // Simplified match
          const found = db.agencyStaff.find(s => {
            if (args.where.id) return s.id === args.where.id;
            if (args.where.userId) return s.userId === args.where.userId;
            // Add composite key support if needed (e.g. userId_agencyId) but usually findUnique uses id or unique constraint
            return false;
          });
          return Promise.resolve(found || null);
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      $disconnect: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    },
  };
});

// Mock Redis
vi.mock('../src/redis', () => ({
  default: {
    flushall: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import prisma from '../src/prisma';
import { createAgency, createUser, linkAgencyStaff } from './utils/factories';
import { Role } from '@prisma/client';

describe('User RBAC and deactivation', () => {
  it('blocks login and refresh for deactivated users', async () => {
    const email = `inactive_${Date.now()}@example.com`;
    const password = 'password123';
    const user = await createUser({ email, password });

    // Deactivate before login
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(401);

    // Activate, login, then deactivate to ensure refresh is blocked
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, deactivatedAt: null },
    });
    const activeLogin = await request(app).post('/api/auth/login').send({ email, password });
    expect(activeLogin.status).toBe(200);
    const refreshToken = activeLogin.body.refreshToken as string;

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('prevents agency staff from mutating users in other agencies', async () => {
    const [agencyA, agencyB] = await Promise.all([
      createAgency({ name: 'A' }),
      createAgency({ name: 'B' }),
    ]);
    const staffAEmail = `staffA_${Date.now()}@example.com`;
    const staffBEmail = `staffB_${Date.now()}@example.com`;

    const [staffA, staffB] = await Promise.all([
      createUser({ email: staffAEmail, role: Role.AGENCY_STAFF }),
      createUser({ email: staffBEmail, role: Role.AGENCY_STAFF }),
    ]);
    await linkAgencyStaff(staffA.id, agencyA.id);
    await linkAgencyStaff(staffB.id, agencyB.id);

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: staffAEmail, password: 'password123' });
    expect(loginA.status).toBe(200);
    const tokenA = loginA.body.token as string;

    const res = await request(app)
      .patch(`/api/admin/agency/users/${staffB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ staffRole: 'SUPERVISOR' });

    expect(res.status).toBe(403);
  });
});
