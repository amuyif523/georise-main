import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../../prisma";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../config/env";
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

    const payload: AuthTokenPayload = {
      userId: user.id,
      role: user.role,
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET as jwt.Secret,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    return {
      token,
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
