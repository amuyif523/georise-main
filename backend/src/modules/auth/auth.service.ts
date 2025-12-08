import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../../prisma";
import {
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
} from "../../config/env";
import {
  AuthTokenPayload,
  LoginRequestBody,
  RegisterRequestBody,
} from "./auth.types";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export class AuthService {
  async register(data: RegisterRequestBody) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Email already in use");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const role: Role = data.role || "CITIZEN";

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

    return user;
  }

  async login(data: LoginRequestBody) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      await this.bumpFailureByEmail(data.email);
      throw new Error("Invalid credentials");
    }

    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      throw new Error("Account temporarily locked due to failed attempts. Please try later.");
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      await this.bumpFailure(user.id, user.failedLoginAttempts ?? 0);
      throw new Error("Invalid credentials");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const access = this.createAccessToken(user.id, user.role, user.tokenVersion ?? 0);
    const refresh = this.createRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: access,
      refreshToken: refresh,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
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

  createAccessToken(userId: number, role: Role, tokenVersion: number) {
    const payload: AuthTokenPayload = { userId, role, tokenVersion };
    return jwt.sign(
      payload,
      JWT_SECRET as jwt.Secret,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );
  }

  createRefreshToken(userId: number, tokenVersion: number) {
    return jwt.sign(
      { userId, tokenVersion },
      JWT_REFRESH_SECRET as jwt.Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );
  }

  verifyRefresh(token: string) {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number; tokenVersion?: number };
  }

  async rotateRefresh(oldToken: string) {
    const decoded = this.verifyRefresh(oldToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.isActive === false) throw new Error("User not active");
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new Error("Invalid refresh token");
    }

    const access = this.createAccessToken(user.id, user.role, user.tokenVersion ?? 0);
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
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  private async bumpFailure(userId: number, current: number) {
    const nextCount = current + 1;
    const lockUntil =
      nextCount >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_DURATION_MS) : null;
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
}

export const authService = new AuthService();
