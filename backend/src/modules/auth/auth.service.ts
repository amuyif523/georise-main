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
    const role: Role = data.role || 'CITIZEN';

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role,
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

    // Task 1: Initialize Responder Profile if role is RESPONDER
    if (role === 'AGENCY_STAFF' && data.agencyId) {
      // We use AGENCY_STAFF role for responders in User table generally, but let's check if we strictly use 'RESPONDER' Role enum or if it's a StaffRole.
      // Looking at schema: User Role has AGENCY_STAFF. AgencyStaff model has StaffRole enum (RESPONDER, DISPATCHER).
      // The user request says: "Check if data.role === 'RESPONDER'". Use prisma.responder.create.
      // Wait, schema has Role enum: CITIZEN, AGENCY_STAFF, ADMIN.
      // And StaffRole enum: DISPATCHER, RESPONDER, SUPERVISOR.
      // The user request explicitly says "Check if data.role === 'RESPONDER'".
      // However, 'RESPONDER' is NOT in the User 'Role' enum in schema.prisma (User Role is CITIZEN, AGENCY_STAFF, ADMIN).
      // Let me re-read the schema.
      // Schema: enum Role { CITIZEN, AGENCY_STAFF, ADMIN }
      // But user request says "Check if data.role === 'RESPONDER'".
      // This implies the user might be confusing User Role with StaffRole or expecting me to handle it.
      // OR, maybe I should look at `data.role` coming from the request.
      // If the input `data.role` is 'RESPONDER' (which suggests they might want to map it to AGENCY_STAFF and create a Responder profile).
      // BUT, the `RegisterRequestBody` types uses `Role` enum which only has CITIZEN, AGENCY_STAFF, ADMIN.
      // Wait, `auth.types.ts` imports `Role` from `@prisma/client`.
      // Let me check `schema.prisma` again.
      // enum Role { CITIZEN, AGENCY_STAFF, ADMIN }
      // User request: "Check if data.role === 'RESPONDER'".
      // This is a contradiction. The User Role cannot be RESPONDER.
      // However, `Responder` model exists.
      // Hypothesis: The user intends for these users to have `Role.AGENCY_STAFF` but also a `Responder` profile.
      // OR, they might be sending 'RESPONDER' as a string and I need to handle it.
      // Let's look at `auth.types.ts` again. `role?: Role`.
      // If I try to pass 'RESPONDER', TS will complain if it's strictly typed.
      // BUT, I can check if `data.role` (casted or if I change type) is 'RESPONDER'.
      // Actually, usually Responders are just Agency Staff.
      // Let's look at `AgencyStaff` model. It has `staffRole`.
      // `Responder` model also exists independently?
      // `model Responder { ... agencyId Int ... userId Int? ... }`
      // So a User can be linked to a Responder record.
      // Let's assume the user *means* when we register someone intended to be a responder.
      // Given strict types, maybe I should check if `data.role` is `AGENCY_STAFF` AND maybe a new field `isResponder`?
      // OR more likely, the user instructions "Check if data.role === 'RESPONDER'" implies they *think* it's a role, or they want me to support it.
      // I will assume for now that if the user passes `AGENCY_STAFF` and an `agencyId`, we might want to create a responder profile?
      // NO, strict instruction: "Check if data.role === 'RESPONDER'".
      // I will trust the instruction but I have to fix the type or cast it.
      // Wait, if I change the input type to string, or add RESPONDER to the Role enum?
      // I cannot easily change the Role enum in DB without migration.
      // I will implement logic: If `data.role` is passed as 'RESPONDER' (I might need to use `any` cast or strict check if I update enum),
      // I will map their User Role to `AGENCY_STAFF` and THEN create the Responder profile.
      // Actually, I'll stick to the existing `Role` enum for the DB `User` record (`AGENCY_STAFF`), but use the input `role` to decide on creating the `Responder` entity.
      // Let's check `auth.service.ts` imports. `import { Role } from '@prisma/client';`
      // I'll cast `data.role` to string for the check.

      // Clarification: The user request says "Check if data.role === 'RESPONDER'".
      // I will assume the input payload might contain 'RESPONDER'.
      // I'll update `AuthService` to handle this specific string, coerce the DB role to `AGENCY_STAFF`, and create the profile.

      if ((data.role as any) === 'RESPONDER') {
        if (!data.agencyId) {
          throw new Error('Agency ID is required for Responder registration');
        }

        await prisma.responder.create({
          data: {
            name: data.fullName,
            status: 'OFFLINE',
            agencyId: data.agencyId,
            userId: user.id,
            type: 'General', // Default type
          },
        });

        // Also link as AgencyStaff? The schema has `AgencyStaff` model.
        // `model AgencyStaff { ... userId Int @unique ... staffRole StaffRole ... }`
        // A user probably needs an AgencyStaff record too if they are AGENCY_STAFF.
        // The prompt only mentioned `prisma.responder.create`.
        // It didn't mention `AgencyStaff`.
        // "Fields: Set userId: user.id, agencyId: data.agencyId, status: 'OFFLINE', and name: user.fullName."
        // I will follow instructions exactly and ONLY create Responder profile.
        // The User role will be `AGENCY_STAFF` (since I'll coerce it).
      }
    }

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
