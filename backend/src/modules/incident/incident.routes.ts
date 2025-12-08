import { Router } from "express";
import { IncidentStatus, Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import prisma from "../../prisma";
import {
  createIncident,
  getMyIncidentById,
  getMyIncidents,
} from "./incident.controller";
import { validateBody } from "../../middleware/validate";
import { createIncidentSchema } from "./incident.validation";
import { emitIncidentUpdated, toIncidentPayload } from "../../events/incidentEvents";
import { reputationService } from "../reputation/reputation.service";
import { logActivity } from "./activity.service";
import { getIO } from "../../socket";

const router = Router();

// Citizen routes
router.post(
  "/",
  requireAuth,
  requireRole([Role.CITIZEN]),
  validateBody(createIncidentSchema),
  createIncident
);
router.get("/my", requireAuth, requireRole([Role.CITIZEN]), getMyIncidents);
router.get("/my/:id", requireAuth, requireRole([Role.CITIZEN]), getMyIncidentById);

// Timeline (role-checked)
router.get("/:id/timeline", requireAuth, async (req, res) => {
  const incidentId = Number(req.params.id);
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { reporterId: true, assignedAgencyId: true },
  });
  if (!incident) return res.status(404).json({ message: "Incident not found" });

  if (req.user?.role === Role.CITIZEN && incident.reporterId !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (req.user?.role === Role.AGENCY_STAFF && incident.assignedAgencyId == null) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const logs = await prisma.activityLog.findMany({
    where: { incidentId },
    orderBy: { createdAt: "desc" },
  });

  const filtered =
    req.user?.role === Role.CITIZEN
      ? logs.filter((l) => l.type === "STATUS_CHANGE" || l.type === "SYSTEM")
      : logs;

  res.json({ logs: filtered });
});

// Comment
router.post(
  "/:id/comment",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const incidentId = Number(req.params.id);
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });
      await logActivity(incidentId, "COMMENT", message, req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to add comment" });
    }
  }
);

// Generic status update
router.patch(
  "/:id/status",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const incidentId = Number(req.params.id);
      const { status } = req.body as { status: IncidentStatus };
      if (!status) return res.status(400).json({ message: "Status required" });
      const updated = await prisma.incident.update({
        where: { id: incidentId },
        data: { status },
      });
      await logActivity(incidentId, "STATUS_CHANGE", `Status set to ${status}`, req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      res.json({ incident: updated });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to update status" });
    }
  }
);

// List/filter for agencies/admins
router.get(
  "/",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { status, hours, reviewStatus } = req.query;
      const conditions: any = {};
      if (status && typeof status === "string") conditions.status = status as IncidentStatus;
      if (reviewStatus && typeof reviewStatus === "string") conditions.reviewStatus = reviewStatus;
      if (hours) {
        const since = new Date(Date.now() - Number(hours) * 3600 * 1000);
        conditions.createdAt = { gte: since };
      }
      if (req.query.subCityId) {
        conditions.subCityId = Number(req.query.subCityId);
      }

      const incidents = await prisma.incident.findMany({
        where: conditions,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          category: true,
          severityScore: true,
          status: true,
          latitude: true,
          longitude: true,
          subCityId: true,
          reviewStatus: true,
          createdAt: true,
          reporter: {
            select: { id: true, fullName: true, trustScore: true },
          },
        },
      });

      res.json({ incidents });
    } catch (err: any) {
      console.error("List incidents error:", err);
      res.status(400).json({ message: err?.message || "Failed to fetch incidents" });
    }
  }
);

// Nearby search using PostGIS location
router.get(
  "/nearby",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { lat, lng, radius = 1000 } = req.query;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radiusNum = Number(radius);

      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ message: "lat and lng are required and must be numbers" });
      }

      const incidents = await prisma.$queryRaw<
        Array<{
          id: number;
          title: string;
          category: string | null;
          severityScore: number | null;
          status: string;
          latitude: number | null;
          longitude: number | null;
          createdAt: Date;
        }>
      >`
        SELECT id, title, category, "severityScore", status, latitude, longitude, "createdAt"
        FROM "Incident"
        WHERE location IS NOT NULL
          AND ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(${lngNum}, ${latNum}), 4326),
            ${radiusNum}
          )
        ORDER BY "severityScore" DESC NULLS LAST, "createdAt" DESC
      `;

      res.json({ incidents });
    } catch (err: any) {
      console.error("Nearby incidents error:", err);
      res.status(400).json({ message: err?.message || "Failed to fetch nearby incidents" });
    }
  }
);

// Assign/respond/resolve workflow for agencies
router.patch(
  "/:id/assign",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.ASSIGNED,
          assignedAgencyId: req.body.assignedAgencyId ?? null,
        },
      });

      await logActivity(updated.id, "ASSIGNMENT", `Assigned to agency ${updated.assignedAgencyId ?? "N/A"}`, req.user!.id);
      if (updated.assignedAgencyId) {
        const io = getIO();
        io.to(`agency:${updated.assignedAgencyId}`).emit("incident:assigned", toIncidentPayload(updated));
      }
      emitIncidentUpdated(toIncidentPayload(updated));
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "ASSIGN_INCIDENT",
          targetType: "Incident",
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: any) {
      console.error("Assign incident error:", err);
      res.status(400).json({ message: err?.message || "Failed to assign incident" });
    }
  }
);

router.patch(
  "/:id/respond",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.RESPONDING,
        },
      });

      await logActivity(updated.id, "STATUS_CHANGE", "Status set to RESPONDING", req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "RESPOND_INCIDENT",
          targetType: "Incident",
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: any) {
      console.error("Respond incident error:", err);
      res.status(400).json({ message: err?.message || "Failed to update incident" });
    }
  }
);

router.patch(
  "/:id/resolve",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          status: IncidentStatus.RESOLVED,
        },
      });

      await logActivity(updated.id, "STATUS_CHANGE", "Status set to RESOLVED", req.user!.id);
      emitIncidentUpdated(toIncidentPayload(updated));
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "RESOLVE_INCIDENT",
          targetType: "Incident",
          targetId: Number(id),
        },
      });

      res.json({ incident: updated });
    } catch (err: any) {
      console.error("Resolve incident error:", err);
      res.status(400).json({ message: err?.message || "Failed to resolve incident" });
    }
  }
);

// Review incidents (admin/agency)
router.post(
  "/:id/review",
  requireAuth,
  requireRole([Role.ADMIN, Role.AGENCY_STAFF]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { decision, note } = req.body as { decision: "APPROVE" | "REJECT"; note?: string };
      const incident = await prisma.incident.findUnique({
        where: { id: Number(id) },
        include: { reporter: true },
      });
      if (!incident) return res.status(404).json({ message: "Incident not found" });

      const reviewStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const updated = await prisma.incident.update({
        where: { id: Number(id) },
        data: {
          reviewStatus,
          reviewedById: req.user!.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });

      if (incident.reporterId) {
        if (decision === "APPROVE") await reputationService.onIncidentValidated(incident.reporterId);
        else await reputationService.onIncidentRejected(incident.reporterId);
      }

      emitIncidentUpdated(toIncidentPayload(updated));
      return res.json({ incident: updated });
    } catch (err: any) {
      console.error("Review incident error:", err);
      res.status(400).json({ message: err?.message || "Failed to review incident" });
    }
  }
);

export default router;
