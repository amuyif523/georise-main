import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import prisma from "../../prisma";
import { z } from "zod";
import { validateBody } from "../../middleware/validate";

const router = Router();
const idSchema = z.object({ id: z.string().transform((v) => Number(v)).pipe(z.number().int().positive()) });

// Pending agencies
router.get(
  "/agencies/pending",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const agencies = await prisma.agency.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
    });
    res.json({ agencies });
  }
);

// Approve agency
router.patch(
  "/agencies/:id/approve",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: "Invalid agency id" });
    const agencyId = parsed.data.id;
    const agency = await prisma.agency.update({
      where: { id: agencyId },
      data: { isApproved: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "APPROVE_AGENCY",
        targetType: "Agency",
        targetId: agencyId,
      },
    });

    res.json({ agency });
  }
);

// Update boundary with GeoJSON polygon
router.patch(
  "/agencies/:id/boundary",
  requireAuth,
  requireRole([Role.ADMIN]),
  validateBody(z.object({ geojson: z.string().min(10) })),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: "Invalid agency id" });
    const agencyId = parsed.data.id;
    const { geojson } = req.body as { geojson: string };

    await prisma.$executeRaw`
      UPDATE "Agency"
      SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)
      WHERE id = ${agencyId};
    `;

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "UPDATE_BOUNDARY",
        targetType: "Agency",
        targetId: agencyId,
      },
    });

    res.json({ success: true });
  }
);

// List users (basic)
router.get(
  "/users",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        citizenVerification: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  }
);

// Toggle user active status
router.patch(
  "/users/:id/toggle",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: "Invalid user id" });
    const userId = parsed.data.id;
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) return res.status(404).json({ message: "User not found" });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !current.isActive },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: updated.isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        targetType: "User",
        targetId: userId,
      },
    });

    res.json({ user: updated });
  }
);

// Verify citizen
router.patch(
  "/users/:id/verify",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ message: "Invalid user id" });
    const userId = parsed.data.id;
    await prisma.citizenVerification.upsert({
      where: { userId },
      update: { status: "VERIFIED" },
      create: {
        userId,
        nationalId: "manual",
        phone: "manual",
        status: "VERIFIED",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "VERIFY_USER",
        targetType: "User",
        targetId: userId,
      },
    });

    res.json({ success: true });
  }
);

// Audit logs
router.get(
  "/audit",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    });
    res.json({ logs });
  }
);

// Analytics
router.get(
  "/analytics",
  requireAuth,
  requireRole([Role.ADMIN]),
  async (_req, res) => {
    const total = await prisma.incident.count();
    const active = await prisma.incident.count({
      where: { status: { in: ["RECEIVED", "UNDER_REVIEW", "ASSIGNED", "RESPONDING"] } },
    });
    const resolved = await prisma.incident.count({
      where: { status: "RESOLVED" },
    });

    const byAgency = await prisma.incident.groupBy({
      by: ["assignedAgencyId"],
      _count: { _all: true },
    });

    const agencyNames = await prisma.agency.findMany({
      select: { id: true, name: true },
    });
    const nameMap = new Map(agencyNames.map((a) => [a.id, a.name]));

    res.json({
      totals: { total, active, resolved },
      byAgency: byAgency.map((row) => ({
        agencyId: row.assignedAgencyId,
        agencyName: row.assignedAgencyId ? nameMap.get(row.assignedAgencyId) : "Unassigned",
        count: row._count._all,
      })),
    });
  }
);

export default router;
