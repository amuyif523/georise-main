import prisma from "../../prisma";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class ReputationService {
  private MIN = -20;
  private MAX = 100;

  async adjustTrust(userId: number, delta: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
    if (!user) return null;
    const newScore = clamp((user.trustScore ?? 0) + delta, this.MIN, this.MAX);
    await prisma.user.update({
      where: { id: userId },
      data: { trustScore: newScore },
    });
    return newScore;
  }

  async getTier(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true, citizenVerification: true } });
    if (!user) return 0;
    
    const score = user.trustScore ?? 0;
    const isVerified = user.citizenVerification?.status === "VERIFIED";

    if (score >= 50 && isVerified) return 3; // Trusted Reporter
    if (isVerified) return 2; // ID Verified
    if (score >= 10) return 1; // Phone Verified (simulated)
    return 0; // Unverified
  }

  async onIncidentCreated(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { totalReports: { increment: 1 }, lastReportAt: new Date() },
    });
  }

  async onIncidentValidated(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { validReports: { increment: 1 } },
    });
    return this.adjustTrust(userId, 5);
  }

  async onIncidentRejected(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { rejectedReports: { increment: 1 } },
    });
    return this.adjustTrust(userId, -10);
  }

  async onVerificationApproved(userId: number) {
    return this.adjustTrust(userId, 5);
  }

  async onVerificationRejected(userId: number) {
    return this.adjustTrust(userId, -3);
  }
}

export const reputationService = new ReputationService();
