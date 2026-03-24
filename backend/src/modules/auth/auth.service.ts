// ... other imports ...

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma, Role } from '@prisma/client';
import crypto from 'crypto';
import prisma from '../../prisma';
import {
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
  DEMO_MODE,
  RESPONDER_INVITE_SECRET,
  RESPONDER_INVITE_EXPIRES_IN,
} from '../../config/env';
import {
  AuthTokenPayload,
  LoginRequestBody,
  RegisterRequestBody,
  PasswordResetRequestBody,
  PasswordResetConfirmBody,
  CompleteOnboardingBody,
  ResponderInviteTokenPayload,
  ResponderOnboardBody,
} from './auth.types';

import { smsService } from '../sms/sms.service';
import logger from '../../logger';
import { NODE_ENV } from '../../config/env';
import redis from '../../redis';

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

type AuthUserShape = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  mustChangePassword: boolean;
  role: Role;
  trustScore: number | null;
  totalReports: number | null;
  validReports: number | null;
  rejectedReports: number | null;
  isVerified: boolean;
  createdAt: Date;
  agencyStaff: {
    agencyId: number;
    staffRole: string;
  } | null;
  verificationRequest: {
    id: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export class AuthService {
  private readonly userInclude = {
    agencyStaff: {
      select: {
        agencyId: true,
        staffRole: true,
      },
    },
    verificationRequest: {
      select: {
        id: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  } satisfies Prisma.UserInclude;

  private getAuthUserSelect() {
    return {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      mustChangePassword: true,
      role: true,
      trustScore: true,
      totalReports: true,
      validReports: true,
      rejectedReports: true,
      isVerified: true,
      createdAt: true,
      ...this.userInclude,
    } satisfies Prisma.UserSelect;
  }

  private toAuthUser(
    user: AuthUserShape,
  ) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      agencyId: user.agencyStaff?.agencyId ?? null,
      trustScore: user.trustScore ?? 0,
      totalReports: user.totalReports ?? 0,
      validReports: user.validReports ?? 0,
      rejectedReports: user.rejectedReports ?? 0,
      isVerified: user.isVerified,
      verificationRequest: user.verificationRequest ?? null,
      createdAt: user.createdAt,
    };
  }

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
        mustChangePassword: false,
        role: dbRole,
        trustScore: dbRole === 'CITIZEN' ? 10 : 0, // Set initial trust score to 10 for better demo experience
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
    } else if (dbRole === 'AGENCY_STAFF' && data.agencyId) {
      // Create AgencyStaff for regular staff
      await prisma.agencyStaff.create({
        data: {
          userId: user.id,
          agencyId: data.agencyId,
          staffRole: 'DISPATCHER',
          isActive: true,
        },
      });
    }

    // If phone is provided, trigger phone OTP setup only.
    // Identity verification requests are created later, after the citizen submits documents.
    if (data.phone) {
      try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await redis.set(`otp:${data.phone}`, otp, 'EX', 300);

        await prisma.citizenVerification.create({
          data: {
            userId: user.id,
            nationalId: 'PENDING',
            phone: data.phone,
            otpCode: otp,
            otpExpiresAt: expiresAt,
          },
        });

        if (DEMO_MODE) {
          console.log('\n=============================================');
          console.log(`[DEMO] OTP for ${data.phone}: ${otp}`);
          console.log('=============================================\n');
        } else {
          await smsService.sendSMS(
            data.phone,
            `Welcome to GEORISE! Your verification code is: ${otp}`,
          );
        }
      } catch (error) {
        // Log error but don't fail registration
        console.error('Failed to send initial OTP:', error);
      }
    }

    // Responder profile handled above during creation

    const authUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: this.getAuthUserSelect(),
    });

    if (!authUser) {
      throw new Error('User not found after registration');
    }

    return this.toAuthUser(authUser);
  }

  async requestOtp(phone: string) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error('User not found with this phone number');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await redis.set(`otp:${phone}`, otp, 'EX', 300);

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

    if (DEMO_MODE) {
      console.log('\n=============================================');
      console.log(`[DEMO] OTP for ${phone}: ${otp}`);
      console.log('=============================================\n');
    } else {
      await smsService.sendSMS(phone, `Your GEORISE verification code is: ${otp}`);
    }
    return { message: 'OTP sent' };
  }

  async verifyOtpLogin(phone: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        citizenVerification: true,
        ...this.userInclude,
      },
    });

    if (!user || !user.citizenVerification) throw new Error('Invalid request');
    if (user.isActive === false || user.deactivatedAt) throw new Error('Account is inactive');

    // Verify primarily with Redis but fallback/sync to db
    const redisOtp = await redis.get(`otp:${phone}`);
    if (redisOtp) {
      if (redisOtp !== code) throw new Error('Invalid OTP code');
      await redis.del(`otp:${phone}`);
    } else {
      const { otpCode, otpExpiresAt } = user.citizenVerification;
      if (!otpCode || !otpExpiresAt || otpExpiresAt < new Date()) {
        throw new Error('OTP expired or invalid');
      }
      if (otpCode !== code) {
        throw new Error('Invalid OTP code');
      }
    }

    // Clear OTP
    await prisma.citizenVerification.update({
      where: { userId: user.id },
      data: { otpCode: null, otpExpiresAt: null },
    });

    // Generate tokens
    const agencyId = user.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(
      user.id,
      user.role,
      user.tokenVersion ?? 0,
      agencyId,
      user.mustChangePassword,
    );
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: access,
      refreshToken: refresh,
      user: this.toAuthUser(user),
    };
  }

  async login(data: LoginRequestBody) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        ...this.getAuthUserSelect(),
        passwordHash: true,
        isActive: true,
        deactivatedAt: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        tokenVersion: true,
      },
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
    const access = this.createAccessToken(
      user.id,
      user.role,
      user.tokenVersion ?? 0,
      agencyId,
      user.mustChangePassword,
    );
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
      user: this.toAuthUser(user),
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return decoded;
  }

  createResponderInviteToken(
    userId: number,
    responderId: number,
    agencyId: number,
    tokenVersion: number,
  ) {
    const payload: ResponderInviteTokenPayload = {
      userId,
      responderId,
      agencyId,
      role: 'AGENCY_STAFF',
      tokenVersion,
      purpose: 'responder_onboard',
    };

    return jwt.sign(payload, RESPONDER_INVITE_SECRET as jwt.Secret, {
      expiresIn: RESPONDER_INVITE_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  verifyResponderInviteToken(token: string) {
    const decoded = jwt.verify(token, RESPONDER_INVITE_SECRET) as ResponderInviteTokenPayload;
    if (decoded.purpose !== 'responder_onboard') {
      throw new Error('Invalid onboarding token');
    }
    return decoded;
  }

  createAccessToken(
    userId: number,
    role: Role,
    tokenVersion: number,
    agencyId?: number | null,
    mustChangePassword?: boolean,
  ) {
    const payload: AuthTokenPayload = {
      userId,
      role,
      tokenVersion,
      agencyId,
      mustChangePassword,
    };
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
      select: {
        ...this.getAuthUserSelect(),
        isActive: true,
        tokenVersion: true,
      },
    });

    if (!user || user.isActive === false) throw new Error('User not active');
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new Error('Invalid refresh token');
    }

    const agencyId = user.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(
      user.id,
      user.role,
      user.tokenVersion ?? 0,
      agencyId,
      user.mustChangePassword,
    );
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: access,
      refreshToken: refresh,
      user: this.toAuthUser(user),
    };
  }

  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: this.getAuthUserSelect(),
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.toAuthUser(user);
  }

  async completeOnboarding(userId: number, data: CompleteOnboardingBody) {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.getAuthUserSelect(),
        isActive: true,
        deactivatedAt: true,
        tokenVersion: true,
      },
    });

    if (!currentUser || currentUser.isActive === false || currentUser.deactivatedAt) {
      throw new Error('User not active');
    }

    if (!currentUser.mustChangePassword) {
      throw new Error('Onboarding is already complete');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: {
          ...this.getAuthUserSelect(),
          tokenVersion: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'COMPLETE_ONBOARDING',
          targetType: 'User',
          targetId: userId,
          note: 'Initial OTP replaced with a permanent password',
        },
      });

      return user;
    });

    const agencyId = updatedUser.agencyStaff?.agencyId || null;
    const access = this.createAccessToken(
      updatedUser.id,
      updatedUser.role,
      updatedUser.tokenVersion ?? 0,
      agencyId,
      updatedUser.mustChangePassword,
    );
    const refresh = this.createRefreshToken(updatedUser.id, updatedUser.tokenVersion ?? 0);

    return {
      token: access,
      refreshToken: refresh,
      user: this.toAuthUser(updatedUser),
    };
  }

  async onboardResponder(data: ResponderOnboardBody) {
    const decoded = this.verifyResponderInviteToken(data.token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        ...this.getAuthUserSelect(),
        passwordHash: true,
        isActive: true,
        deactivatedAt: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw new Error('Invite target not found');
    }

    if (user.role !== 'AGENCY_STAFF') {
      throw new Error('Invite target is not an agency responder');
    }

    if ((user.tokenVersion ?? 0) !== decoded.tokenVersion) {
      throw new Error('Onboarding token is no longer valid');
    }

    if (user.isActive && !user.deactivatedAt) {
      throw new Error('Responder account is already onboarded');
    }

    const responder = await prisma.responder.findUnique({
      where: { id: decoded.responderId },
      select: { id: true, agencyId: true, userId: true, status: true },
    });

    if (!responder || responder.userId !== user.id || responder.agencyId !== decoded.agencyId) {
      throw new Error('Responder record does not match invite token');
    }

    if (!data.biometricEnabled) {
      throw new Error('Biometric enablement is required during responder onboarding');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const onboardedUser = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          deactivatedAt: null,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: this.getAuthUserSelect(),
      });

      await tx.responder.update({
        where: { id: responder.id },
        data: { status: 'OFFLINE' },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'RESPONDER_ONBOARDED',
          targetType: 'Responder',
          targetId: responder.id,
          note: 'Responder set initial password and confirmed biometric enrollment',
        },
      });

      return updatedUser;
    });

    const agencyId = onboardedUser.agencyStaff?.agencyId || null;
    const currentTokenVersion = (user.tokenVersion ?? 0) + 1;
    const access = this.createAccessToken(
      onboardedUser.id,
      onboardedUser.role,
      currentTokenVersion,
      agencyId,
      onboardedUser.mustChangePassword,
    );
    const refresh = this.createRefreshToken(onboardedUser.id, currentTokenVersion);

    return {
      token: access,
      refreshToken: refresh,
      user: this.toAuthUser(onboardedUser),
    };
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

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    if (DEMO_MODE) {
      console.log('\n=============================================');
      console.log(`[DEMO] Reset Code for ${user.email || user.phone}: ${token}`);
      console.log('=============================================\n');
    } else if (user.phone) {
      await smsService.sendSMS(
        user.phone,
        `Use this code to reset your GEORISE password: ${token}. It expires in 5 minutes.`,
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
          mustChangePassword: false,
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
