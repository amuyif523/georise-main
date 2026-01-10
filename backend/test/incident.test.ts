import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/prisma';
import { createUser } from './utils/factories';
import { authService } from '../src/modules/auth/auth.service';

describe('Incident flows', () => {
  it('creates an incident as a citizen', async () => {
    const user = await createUser({ role: Role.CITIZEN });
    const token = authService.createAccessToken(user.id, Role.CITIZEN, 0);

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
    const user = await createUser({ role: Role.CITIZEN });
    const citizenToken = authService.createAccessToken(user.id, Role.CITIZEN, 0);

    const admin = await createUser({ role: Role.ADMIN });
    const adminToken = authService.createAccessToken(admin.id, Role.ADMIN, 0);

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

    const reviewRes = await request(app)
      .post(`/api/incidents/${incidentId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE' });

    expect(reviewRes.status).toBe(200);
    const updated = await prisma.incident.findUnique({ where: { id: incidentId } });
    expect(updated?.reviewStatus).toBe('APPROVED');
  });
});
