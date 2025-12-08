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

const failedAttempts = new Map<
  string,
  {
    count: number;
    lockedUntil?: number;
  }
>();
const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 30 * 60 * 1000;

const refreshStore = new Map<
  number,
  {
    token: string;
    tokenVersion: number;
    exp: number;
  }
>();

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
        createdAt: true,
      },
    });

    return user;
  }

  async login(data: LoginRequestBody) {
    const record = failedAttempts.get(data.email);
    const now = Date.now();
    if (record?.lockedUntil && record.lockedUntil > now) {
      throw new Error("Account temporarily locked due to failed attempts. Please try later.");
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      this.bumpFailure(data.email);
      throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      this.bumpFailure(data.email);
      throw new Error("Invalid credentials");
    }

    failedAttempts.delete(data.email);

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
    const token = jwt.sign(
      { userId, tokenVersion },
      JWT_REFRESH_SECRET as jwt.Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );
    const decoded = jwt.decode(token) as { exp?: number };
    refreshStore.set(userId, { token, tokenVersion, exp: decoded?.exp ? decoded.exp * 1000 : 0 });
    return token;
  }

  verifyRefresh(token: string) {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number; tokenVersion?: number };
    const stored = refreshStore.get(decoded.userId);
    if (!stored || stored.token !== token || stored.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      throw new Error("Invalid refresh token");
    }
    return decoded;
  }

  async rotateRefresh(oldToken: string) {
    const decoded = this.verifyRefresh(oldToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.isActive === false) throw new Error("User not active");

    const access = this.createAccessToken(user.id, user.role, decoded.tokenVersion ?? 0);
    const refresh = this.createRefreshToken(user.id, decoded.tokenVersion ?? 0);
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

  private bumpFailure(email: string) {
    const now = Date.now();
    const current = failedAttempts.get(email) || { count: 0 };
    let next = { ...current, count: current.count + 1 };
    // reset window
    if (current.lockedUntil && current.lockedUntil < now) {
      next = { count: 1 };
    }
    if (next.count >= LOCK_THRESHOLD) {
      next.lockedUntil = now + LOCK_DURATION_MS;
    }
    failedAttempts.set(email, next);
  }
}

export const authService = new AuthService();
