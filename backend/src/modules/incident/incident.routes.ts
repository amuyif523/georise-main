import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
  createIncident,
  getMyIncidentById,
  getMyIncidents,
} from "./incident.controller";

const router = Router();

router.post("/", requireAuth, requireRole([Role.CITIZEN]), createIncident);
router.get("/my", requireAuth, requireRole([Role.CITIZEN]), getMyIncidents);
router.get("/my/:id", requireAuth, requireRole([Role.CITIZEN]), getMyIncidentById);

export default router;
