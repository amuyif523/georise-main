import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import prisma from '../src/prisma';
import { createUser } from './utils/factories';

describe('Password reset flow', () => {
  it('issues a reset token and allows password update', async () => {
    const email = `reset_${Date.now()}@example.com`;
    const oldPassword = 'oldPassword123';
    await createUser({ email, password: oldPassword });

    const reqRes = await request(app)
      .post('/api/auth/password-reset/request')
      .send({ identifier: email });

    expect(reqRes.status).toBe(200);
    const token =
      (reqRes.body && reqRes.body.token) ||
      (await prisma.passwordResetToken.findFirst({ where: { user: { email } } }))?.tokenHash;
    expect(token).toBeTruthy();

    const newPassword = 'newPassword456';
    const confirmRes = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: newPassword });
    expect(confirmRes.status).toBe(200);

    // Old password should fail
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: oldPassword });
    expect(oldLogin.status).toBe(401);

    // New password should work
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });
});
