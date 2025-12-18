import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/prisma';
import { createUser } from './utils/factories';

describe('Incident flows', () => {
  it('creates an incident as a citizen', async () => {
    const email = `citizen_${Date.now()}@example.com`;
    const password = 'password123';
    await createUser({ email, password, role: Role.CITIZEN });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const token = loginRes.body.token as string;

    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Fire near Bole',
        description: 'Smoke and flames visible near the main road.',
        latitude: 9.01,
        longitude: 38.74,
      });

    expect(res.status).toBe(201);
    expect(res.body.incident?.id).toBeTruthy();
  });

  it('allows admin to review and approve an incident', async () => {
    const citizenEmail = `citizen_${Date.now()}@example.com`;
    const password = 'password123';
    await createUser({ email: citizenEmail, password, role: Role.CITIZEN });

    const adminEmail = `admin_${Date.now()}@example.com`;
    await createUser({ email: adminEmail, password, role: Role.ADMIN });

    const citizenLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: citizenEmail, password });
    const citizenToken = citizenLogin.body.token as string;

    const incidentRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Traffic crash on main road',
        description: 'Two cars collided, traffic blocked.',
        latitude: 9.02,
        longitude: 38.75,
      });

    const incidentId = incidentRes.body.incident?.id;
    expect(incidentId).toBeTruthy();

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password });
    const adminToken = adminLogin.body.token as string;

    const reviewRes = await request(app)
      .post(`/api/incidents/${incidentId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' });

    expect(reviewRes.status).toBe(200);
    const updated = await prisma.incident.findUnique({ where: { id: incidentId } });
    expect(updated?.reviewStatus).toBe('APPROVED');
  });
});
