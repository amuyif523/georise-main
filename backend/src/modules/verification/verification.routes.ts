import { Router } from "express";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../middleware/auth";
import prisma from "../../prisma";
import { reputationService } from "../reputation/reputation.service";
import { VerificationStatus } from "@prisma/client";

const router = Router();

router.post("/request", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { nationalId, phone } = req.body;
  if (!nationalId || !phone) {
    return res.status(400).json({ message: "nationalId and phone are required" });
  }
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const verification = await prisma.citizenVerification.upsert({
    where: { userId },
    update: { nationalId, phone, status: "PENDING", otpCode, otpExpiresAt },
    create: { userId, nationalId, phone, status: "PENDING", otpCode, otpExpiresAt },
  });
  return res.json({ message: "Verification request created", otpCodeDemo: otpCode, verification });
});

router.post("/confirm-otp", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { otpCode } = req.body;
  const verification = await prisma.citizenVerification.findUnique({ where: { userId } });
  if (!verification || !verification.otpCode || !verification.otpExpiresAt) {
    return res.status(400).json({ message: "No active OTP" });
  }
  if (verification.otpExpiresAt < new Date()) {
    return res.status(400).json({ message: "OTP expired" });
  }
  if (verification.otpCode !== otpCode) {
    return res.status(400).json({ message: "Invalid OTP" });
  }
  const updated = await prisma.citizenVerification.update({
    where: { userId },
    data: { otpCode: null, otpExpiresAt: null, status: "PENDING" },
  });
  return res.json({ message: "OTP confirmed. Awaiting admin decision.", verification: updated });
});

router.get("/pending", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const pending = await prisma.citizenVerification.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { id: true, fullName: true, email: true, trustScore: true } } },
  });
  res.json(pending);
});

router.post("/:userId/decision", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const userId = Number(req.params.userId);
  const { decision } = req.body as { decision: "APPROVE" | "REJECT" };
  const verification = await prisma.citizenVerification.findUnique({ where: { userId } });
  if (!verification) return res.status(404).json({ message: "Verification not found" });
  const status: VerificationStatus = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
  await prisma.citizenVerification.update({ where: { userId }, data: { status } });
  if (decision === "APPROVE") await reputationService.onVerificationApproved(userId);
  else await reputationService.onVerificationRejected(userId);
  res.json({ message: `Verification ${decision.toLowerCase()}` });
});

export default router;
