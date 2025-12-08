import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import prisma from "../../prisma";

const router = Router();

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
    const { id } = req.params;
    const agencyId = Number(id);
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
  async (req, res) => {
    const { id } = req.params;
    const { geojson } = req.body;
    const agencyId = Number(id);

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
    const userId = Number(req.params.id);
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

export default router;
