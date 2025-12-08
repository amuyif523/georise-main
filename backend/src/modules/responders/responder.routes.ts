import { Router } from "express";
import { Role } from "@prisma/client";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";

const router = Router();

// List responders (admin sees all, agency sees own)
router.get("/", requireAuth, async (req: any, res) => {
  const user = req.user!;
  let where: any = {};

  if (user.role === Role.AGENCY_STAFF) {
    const staff = await prisma.agencyStaff.findUnique({ where: { userId: user.id } });
    if (!staff) return res.status(403).json({ message: "No agency context" });
    where.agencyId = staff.agencyId;
  }

  const responders = await prisma.responder.findMany({
    where,
    include: { agency: true, incident: true },
  });
  res.json(responders);
});

// Create responder (admin or agency staff)
router.post("/", requireAuth, requireRole([Role.ADMIN, Role.AGENCY_STAFF]), async (req: any, res) => {
  try {
    const { name, type, agencyId } = req.body;
    if (!name || !type || !agencyId) return res.status(400).json({ message: "name, type, agencyId required" });

    const created = await prisma.responder.create({
      data: { name, type, agencyId: Number(agencyId) },
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "Failed to create responder" });
  }
});

export default router;
