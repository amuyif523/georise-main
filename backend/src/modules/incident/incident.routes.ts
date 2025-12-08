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

// List/filter for agencies/admins
router.get(
  "/",
  requireAuth,
  requireRole([Role.AGENCY_STAFF, Role.ADMIN]),
  async (req, res) => {
    try {
      const { status, hours } = req.query;
      const conditions: any = {};
      if (status && typeof status === "string") conditions.status = status as IncidentStatus;
      if (hours) {
        const since = new Date(Date.now() - Number(hours) * 3600 * 1000);
        conditions.createdAt = { gte: since };
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
          createdAt: true,
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

export default router;
