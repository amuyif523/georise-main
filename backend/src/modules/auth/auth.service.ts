// ... other imports ...

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import prisma from '../../prisma';
import {
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
} from '../../config/env';
import {
  AuthTokenPayload,
  LoginRequestBody,
  RegisterRequestBody,
  PasswordResetRequestBody,
  PasswordResetConfirmBody,
} from './auth.types';

import { smsService } from '../sms/sms.service';
import logger from '../../logger';
import { NODE_ENV } from '../../config/env';
import redis from '../../redis';

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export class AuthService {
  async register(data: RegisterRequestBody) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone }],
      },
    });

    if (existing) {
      throw new Error('Email or Phone already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Handle RESPONDER role mapping:
    // Input 'RESPONDER' -> DB 'AGENCY_STAFF' + Responder Profile creation
    // Input 'AGENCY_STAFF' -> DB 'AGENCY_STAFF'

    let dbRole: Role = 'CITIZEN';
    let isResponder = false;

    console.log('Registering user. Role:', data.role, 'AgencyId:', data.agencyId);

    if (data.role === ('RESPONDER' as any)) {
      dbRole = 'AGENCY_STAFF';
      isResponder = true;
      console.log('Set isResponder=true');
    } else if (data.role) {
      dbRole = data.role as Role;
    }

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: dbRole,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        trustScore: true,
        totalReports: true,
        validReports: true,
        rejectedReports: true,
        createdAt: true,
      },
    });

    // Create Responder Profile if needed
    if (isResponder && data.agencyId) {
      const resp = await prisma.responder.create({
        data: {
          name: user.fullName,
          status: 'OFFLINE',
          agencyId: data.agencyId,
          userId: user.id,
          type: 'General',
        },
      });
      console.log('Created Responder Record:', JSON.stringify(resp, null, 2));

      // Ensure AgencyStaff record exists too for consistency
      await prisma.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId: data.agencyId,
          staffRole: 'RESPONDER',
          isActive: true,
        },
      });
    }

    // If phone is provided, automatically trigger OTP for verification
    if (data.phone) {
      try {
        const otp = smsService.generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.citizenVerification.create({
          data: {
            userId: user.id,
            nationalId: 'PENDING',
            phone: data.phone,
            otpCode: otp,
            otpExpiresAt: expiresAt,
          },
        });

        await smsService.sendSMS(
          data.phone,
          `Welcome to GEORISE! Your verification code is: ${otp}`,
        );
      } catch (error) {
        // Log error but don't fail registration
        console.error('Failed to send initial OTP:', error);
      }
    }

    // Responder profile handled above during creation

    return user;
  }

  async requestOtp(phone: string) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error('User not found with this phone number');

    const otp = smsService.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Upsert verification record
    await prisma.citizenVerification.upsert({
      where: { userId: user.id },
      update: { otpCode: otp, otpExpiresAt: expiresAt },
      create: {
        userId: user.id,
        nationalId: 'PENDING', // Placeholder
        phone: phone,
        otpCode: otp,
        otpExpiresAt: expiresAt,
      },
    });

    await smsService.sendSMS(phone, `Your GEORISE verification code is: ${otp}`);
    return { message: 'OTP sent' };
  }

  async verifyOtpLogin(phone: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { citizenVerification: true, agencyStaff: true },
    });

    if (!user || !user.citizenVerification) throw new Error('Invalid request');
    if (user.isActive === false || user.deactivatedAt) throw new Error('Account is inactive');

    const { otpCode, otpExpiresAt } = user.citizenVerification;
    if (!otpCode || !otpExpiresAt || otpExpiresAt < new Date()) {
      throw new Error('OTP expired or invalid');
    }
    if (otpCode !== code) {
      throw new Error('Invalid OTP code');
    }

    // Clear OTP
    await prisma.citizenVerification.update({
      where: { userId: user.id },
      data: { otpCode: null, otpExpiresAt: null },
    });

    // Generate tokens
    const agencyId = user.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(user.id, user.role, user.tokenVersion ?? 0, agencyId);
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: access,
      refreshToken: refresh,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        agencyId,
        trustScore: user.trustScore ?? 0,
      },
    };
  }

  async login(data: LoginRequestBody) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { agencyStaff: true },
    });

    if (!user) {
      await this.bumpFailureByEmail(data.email);
      throw new Error('Invalid credentials');
    }

    if (user.isActive === false || user.deactivatedAt) {
      throw new Error('Account is inactive');
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      throw new Error('Account temporarily locked due to failed attempts. Please try later.');
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);

    if (!valid) {
      logger.warn({ userId: user.id, email: data.email }, 'Login failure: password mismatch');
      await this.bumpFailure(user.id, user.failedLoginAttempts ?? 0);
      throw new Error('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const agencyId = user.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(user.id, user.role, user.tokenVersion ?? 0, agencyId);
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);

    // Audit login success
    // Audit login success
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'LOGIN_SUCCESS',
        targetType: 'User',
        targetId: user.id,
      },
    });

    return {
      token: access,
      refreshToken: refresh,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        agencyId,
        trustScore: user.trustScore ?? 0,
        totalReports: user.totalReports ?? 0,
        validReports: user.validReports ?? 0,
        rejectedReports: user.rejectedReports ?? 0,
      },
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return decoded;
  }

  createAccessToken(userId: number, role: Role, tokenVersion: number, agencyId?: number | null) {
    const payload: AuthTokenPayload = { userId, role, tokenVersion, agencyId };
    return jwt.sign(payload, JWT_SECRET as jwt.Secret, {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  createRefreshToken(userId: number, tokenVersion: number) {
    return jwt.sign({ userId, tokenVersion }, JWT_REFRESH_SECRET as jwt.Secret, {
      expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  verifyRefresh(token: string) {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number; tokenVersion?: number };
  }

  async rotateRefresh(oldToken: string) {
    const decoded = this.verifyRefresh(oldToken);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { agencyStaff: true },
    });
    if (!user || user.isActive === false || user.deactivatedAt) throw new Error('User not active');
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new Error('Invalid refresh token');
    }

    const agencyId = user.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(user.id, user.role, user.tokenVersion ?? 0, agencyId);
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);
    return { access, refresh, user };
  }

  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        trustScore: true,
        totalReports: true,
        validReports: true,
        rejectedReports: true,
        createdAt: true,
        responders: { select: { id: true, agencyId: true, type: true } },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private async bumpFailure(userId: number, current: number) {
    const nextCount = current + 1;
    const lockUntil = nextCount >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_DURATION_MS) : null;
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextCount,
        lockedUntil: lockUntil,
      },
    });
  }

  private async bumpFailureByEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    await this.bumpFailure(user.id, user.failedLoginAttempts ?? 0);
  }

  async requestPasswordReset(data: PasswordResetRequestBody) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.identifier }, { phone: data.identifier }],
      },
    });

    // Do not leak user existence
    if (!user) {
      return { message: 'If an account exists, reset instructions have been sent.' };
    }

    // Invalidate existing tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Deliver via SMS if phone exists; otherwise log for now (placeholder for email service)
    if (user.phone) {
      await smsService.sendSMS(
        user.phone,
        `Use this code to reset your GEORISE password: ${token}. It expires in 15 minutes.`,
      );
    } else {
      logger.info({ email: user.email, token }, 'Password reset token generated');
    }

    return {
      message: 'If an account exists, reset instructions have been sent.',
      token: NODE_ENV === 'test' ? token : undefined, // exposed only for automated tests
    };
  }

  async confirmPasswordReset(data: PasswordResetConfirmBody) {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 }, // invalidate existing refresh tokens
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset. You can now sign in with the new password.' };
  }

  async revokeSession(userId: number) {
    // Sprint 6: Session Revocation
    // Blacklist the user for 24 hours (matching token expiry)
    await redis.set(`revoked:user:${userId}`, 'true', 'EX', 24 * 60 * 60);
    logger.info({ userId }, 'User session revoked by admin');
  }
}

export const authService = new AuthService();
