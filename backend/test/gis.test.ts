import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import { createAgency, createIncident, createUser, linkAgencyStaff } from './utils/factories';
import { Role } from '@prisma/client';

let adminToken: string;
let agencyToken: string;
let citizenToken: string;
let agencyId: number;

beforeAll(async () => {
  const admin = await createUser({ role: Role.ADMIN, email: 'admin_gis@example.com' });
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'password123' });
  adminToken = `Bearer ${adminLogin.body.token}`;

  const agency = await createAgency({ name: 'GIS Agency' });
  agencyId = agency.id;
  const staff = await createUser({ role: Role.AGENCY_STAFF, email: 'staff_gis@example.com' });
  await linkAgencyStaff(staff.id, agency.id);
  const staffLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: staff.email, password: 'password123' });
  agencyToken = `Bearer ${staffLogin.body.token}`;

  const citizen = await createUser({ email: 'citizen_gis@example.com' });
  const citizenLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: citizen.email, password: 'password123' });
  citizenToken = `Bearer ${citizenLogin.body.token}`;

  await createIncident({
    reporterId: citizen.id,
    latitude: 9.0101,
    longitude: 38.7522,
    title: 'Geo test incident',
    assignedAgencyId: agency.id,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GIS access control and spatial endpoints', () => {
  it('rejects unauthenticated access to boundaries', async () => {
    const res = await request(app).get('/api/gis/boundaries');
    expect(res.status).toBe(401);
  });

  it('rejects citizen access to boundaries', async () => {
    const res = await request(app).get('/api/gis/boundaries').set('Authorization', citizenToken);
    expect(res.status).toBe(403);
  });

  it('admin can fetch boundaries', async () => {
    const res = await request(app).get('/api/gis/boundaries').set('Authorization', adminToken);
    expect(res.status).toBe(200);
  });

  it('agency staff can fetch incidents with geometry', async () => {
    const res = await request(app).get('/api/gis/incidents').set('Authorization', agencyToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('agency staff cannot view other agency incident lists', async () => {
    const otherAgency = await createAgency({ name: 'Other GIS Agency' });
    const incident = await createIncident({
      reporterId: (await createUser({ email: 'citizen2@example.com' })).id,
      latitude: 8.99,
      longitude: 38.75,
      title: 'Other agency incident',
      assignedAgencyId: otherAgency.id,
    });
    const res = await request(app).get('/api/gis/incidents').set('Authorization', agencyToken);
    const ids = res.body.map((r: any) => r.id);
    expect(ids).not.toContain(incident.id);
  });

  it('agency staff can only fetch their agency boundary incidents', async () => {
    const resForbidden = await request(app)
      .get(`/api/gis/boundaries/${agencyId + 1}/incidents?level=agency`)
      .set('Authorization', agencyToken);
    expect(resForbidden.status).toBe(403);

    const resOk = await request(app)
      .get(`/api/gis/boundaries/${agencyId}/incidents?level=agency`)
      .set('Authorization', agencyToken);
    expect(resOk.status).toBe(200);
  });

  it('duplicate check requires auth', async () => {
    const res = await request(app)
      .get('/api/incidents/duplicates')
      .query({ lat: 9.0101, lng: 38.7522, title: 'Geo test', description: 'desc' });
    expect(res.status).toBe(401);
    const resAuth = await request(app)
      .get('/api/incidents/duplicates')
      .query({ lat: 9.0101, lng: 38.7522, title: 'Geo test', description: 'desc' })
      .set('Authorization', agencyToken);
    expect(resAuth.status).toBe(200);
  });
});
