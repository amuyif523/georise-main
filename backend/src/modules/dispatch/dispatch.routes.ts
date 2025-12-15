import { Router } from "express";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { dispatchService } from "./dispatch.service";
import { IncidentStatus } from "@prisma/client";

const router = Router();

// GET /api/dispatch/recommend/:incidentId
router.get("/recommend/:incidentId", requireAuth, requireRole(["AGENCY_STAFF", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.incidentId);
    const recs = await dispatchService.recommendForIncident(id);
    res.json(recs);
  } catch (err: any) {
    console.error("recommendation error", err);
    res.status(400).json({ message: err.message || "Failed to get recommendations" });
  }
});

// POST /api/dispatch/assign
router.post("/assign", requireAuth, requireRole(["AGENCY_STAFF", "ADMIN"]), async (req: any, res) => {
  try {
    const { incidentId, agencyId, unitId } = req.body;
    if (!incidentId || !agencyId) {
      return res.status(400).json({ message: "incidentId and agencyId are required" });
    }

    const incident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        assignedAgencyId: agencyId,
        assignedResponderId: unitId || null, // unitId is now responderId
        status: IncidentStatus.ASSIGNED,
      },
    });

    if (unitId) {
      await prisma.responder.update({
        where: { id: unitId },
        data: { status: "ASSIGNED" },
      });
    }

    res.json({ incident });
  } catch (err: any) {
    console.error("assign error", err);
    res.status(400).json({ message: err.message || "Failed to assign" });
  }
});

// Optional: auto-assign top candidate
router.post("/auto-assign/:incidentId", requireAuth, requireRole(["AGENCY_STAFF", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.incidentId);
    const recs = await dispatchService.recommendForIncident(id);
    if (!recs.length) return res.status(400).json({ message: "No candidates found" });
    const top = recs[0];
    const incident = await prisma.incident.update({
      where: { id },
      data: { 
        assignedAgencyId: top.agencyId, 
        assignedResponderId: top.unitId || null,
        status: IncidentStatus.ASSIGNED 
      },
    });
    if (top.unitId) {
      await prisma.responder.update({
        where: { id: top.unitId },
        data: { status: "ASSIGNED" },
      });
    }
    res.json({ incident, selected: top });
  } catch (err: any) {
    console.error("auto-assign error", err);
    res.status(400).json({ message: err.message || "Failed to auto-assign" });
  }
});

export default router;
