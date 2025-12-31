import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import prisma from '../src/prisma';
import {
  createAgency,
  createIncident,
  createResponder,
  createUser,
  linkAgencyStaff,
} from './utils/factories';
import { IncidentStatus, ResponderStatus, Role } from '@prisma/client';

const loginAsAdmin = async () => {
  const email = `admin_${Date.now()}@example.com`;
  const password = 'password123';
  await createUser({ email, password, role: Role.ADMIN });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  const token = res.body.token as string;
  return { token };
};

describe('Admin agency CRUD and constraints', () => {
  it('lists agencies with filters and pagination metadata', async () => {
    const { token } = await loginAsAdmin();
    await createAgency({ name: 'Alpha Active', isApproved: true, isActive: true });
    await createAgency({ name: 'Beta Pending', isApproved: false, isActive: false });

    const res = await request(app)
      .get('/api/admin/agencies')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'pending', page: 1, limit: 10, search: 'Beta' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.agencies[0].name).toBe('Beta Pending');
  });

  it('blocks deactivating an agency with active incidents', async () => {
    const { token } = await loginAsAdmin();
    const agency = await createAgency();
    await createIncident({
      assignedAgencyId: agency.id,
      status: IncidentStatus.ASSIGNED,
    });

    const res = await request(app)
      .patch(`/api/admin/agencies/${agency.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(409);
  });

  it('deactivates an agency when no active assignments', async () => {
    const { token } = await loginAsAdmin();
    const agency = await createAgency();

    const res = await request(app)
      .delete(`/api/admin/agencies/${agency.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await prisma.agency.findUnique({ where: { id: agency.id } });
    expect(updated?.isActive).toBe(false);
  });
});

describe('Admin user constraints', () => {
  it('blocks deactivating a responder who is active/on-scene', async () => {
    const { token } = await loginAsAdmin();
    const agency = await createAgency();
    const staff = await createUser({
      email: `staff_${Date.now()}@example.com`,
      password: 'password123',
      role: Role.AGENCY_STAFF,
    });
    await linkAgencyStaff(staff.id, agency.id);
    await createResponder({
      agencyId: agency.id,
      userId: staff.id,
      status: ResponderStatus.ON_SCENE,
    });

    const res = await request(app)
      .patch(`/api/admin/users/${staff.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(409);
  });
});
