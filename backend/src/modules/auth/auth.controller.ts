import type { Request, Response } from "express";
import prisma from "../../prisma";
import { authService } from "./auth.service";
import logger from "../../logger";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    return res.status(201).json({ user });
  } catch (err: any) {
    logger.error({ err }, "Register error");
    return res
      .status(400)
      .json({ message: err?.message || "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    if (result.user.role === "ADMIN") {
      await prisma.auditLog.create({
        data: {
          actorId: result.user.id,
          action: "ADMIN_LOGIN",
          targetType: "User",
          targetId: result.user.id,
        },
      });
    }
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error({ err }, "Login error");
    return res.status(401).json({ message: err?.message || "Login failed" });
  }
};

export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone required" });
    const result = await authService.requestOtp(phone);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "Failed to send OTP" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: "Phone and code required" });
    const result = await authService.verifyOtpLogin(phone, code);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "OTP verification failed" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await authService.getCurrentUser(req.user.id);
    return res.status(200).json({ user });
  } catch (err: any) {
    logger.error({ err }, "Me error");
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch user" });
  }
};
