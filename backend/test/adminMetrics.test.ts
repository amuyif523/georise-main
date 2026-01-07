import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import { createUser } from './utils/factories';
import { Role } from '@prisma/client';

describe('Admin metrics authz', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const email = `citizen_metrics_${Date.now()}@example.com`;
    await createUser({ email, password: 'password123', role: Role.CITIZEN });
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'password123',
    });
    const token = loginRes.body.token as string;
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows admin access', async () => {
    const email = `admin_metrics_${Date.now()}@example.com`;
    await createUser({ email, password: 'password123', role: Role.ADMIN });
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'password123',
    });
    const token = loginRes.body.token as string;
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
