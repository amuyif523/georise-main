import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
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
    const [agencyA, agencyB] = await Promise.all([createAgency({ name: 'A' }), createAgency({ name: 'B' })]);
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
