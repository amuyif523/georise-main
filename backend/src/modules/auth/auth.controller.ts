import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { authService } from "./auth.service";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    return res.status(201).json({ user });
  } catch (err: any) {
    console.error("Register error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(401).json({ message: err?.message || "Login failed" });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await authService.getCurrentUser(req.user.id);
    return res.status(200).json({ user });
  } catch (err: any) {
    console.error("Me error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch user" });
  }
};
