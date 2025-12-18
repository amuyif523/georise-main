import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import prisma from '../src/prisma';
import { createUser } from './utils/factories';

describe('Auth flows', () => {
  it('logs in with email and password', async () => {
    const email = `citizen_${Date.now()}@example.com`;
    const password = 'password123';
    await createUser({ email, password });

    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('supports OTP login', async () => {
    const phone = `+2519${Math.floor(10000000 + Math.random() * 89999999)}`;
    await createUser({ phone, email: `otp_${Date.now()}@example.com` });

    const reqRes = await request(app).post('/api/auth/otp/request').send({ phone });
    expect(reqRes.status).toBe(200);

    const verification = await prisma.citizenVerification.findFirst({
      where: { phone },
    });
    expect(verification?.otpCode).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone, code: verification?.otpCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeTruthy();
  });

  it('rotates refresh token', async () => {
    const email = `refresh_${Date.now()}@example.com`;
    const password = 'password123';
    await createUser({ email, password });

    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    const refreshToken = loginRes.body.refreshToken as string;

    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeTruthy();
    expect(refreshRes.body.refreshToken).toBeTruthy();
  });
});
