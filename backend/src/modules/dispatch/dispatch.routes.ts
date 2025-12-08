import { Router } from "express";
import { IncidentStatus, ResponderStatus, Role } from "@prisma/client";
import prisma from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { emitIncidentUpdated, toIncidentPayload } from "../../events/incidentEvents";
import { logActivity } from "../incident/activity.service";
import { getIO } from "../../socket";
import { handleETAAndGeofence } from "./dispatch.service";

const router = Router();

// Assign responder to incident
router.patch(
  "/assign-responder",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { incidentId, responderId } = req.body as { incidentId: number; responderId: number };
      if (!incidentId || !responderId) return res.status(400).json({ message: "incidentId and responderId required" });

      const incident = await prisma.incident.update({
        where: { id: incidentId },
        data: {
          assignedResponderId: responderId,
          status: IncidentStatus.ASSIGNED,
          dispatchedAt: new Date(),
        },
      });

      const responder = await prisma.responder.update({
        where: { id: responderId },
        data: {
          status: ResponderStatus.ASSIGNED,
          incidentId,
        },
      });

      await logActivity(incident.id, "DISPATCH", `Responder ${responder.name} assigned`, req.user!.id);

      const io = getIO();
      io.emit("incident:assignedResponder", { incidentId, responderId });
      emitIncidentUpdated(toIncidentPayload(incident));

      res.json({ incident, responder });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to assign responder" });
    }
  }
);

// Responder marks resolved
router.patch(
  "/resolve",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { incidentId } = req.body as { incidentId: number };
      if (!incidentId) return res.status(400).json({ message: "incidentId required" });
      const now = new Date();
      const incident = await prisma.incident.update({
        where: { id: incidentId },
        data: { status: IncidentStatus.RESOLVED, resolvedAt: now },
      });
      await prisma.responder.updateMany({
        where: { incidentId },
        data: { status: ResponderStatus.AVAILABLE, incidentId: null },
      });
      await logActivity(incident.id, "STATUS_CHANGE", "Incident resolved by responder", req.user!.id);
      emitIncidentUpdated(toIncidentPayload(incident));
      res.json({ incident });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to resolve incident" });
    }
  }
);

export default router;
