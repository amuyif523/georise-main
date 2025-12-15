import type { Request, Response } from "express";
import prisma from "../../prisma";
import { dispatchService } from "./dispatch.service";
import { IncidentStatus } from "@prisma/client";
import logger from "../../logger";

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.incidentId);
    const recs = await dispatchService.recommendForIncident(id);
    res.json(recs);
  } catch (err: any) {
    logger.error({ err }, "Recommendation error");
    res.status(400).json({ message: err.message || "Failed to get recommendations" });
  }
};

export const assignIncident = async (req: Request, res: Response) => {
  try {
    const { incidentId, agencyId, unitId } = req.body;
    if (!incidentId || !agencyId) {
      return res.status(400).json({ message: "incidentId and agencyId are required" });
    }

    const incident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        assignedAgencyId: agencyId,
        assignedResponderId: unitId || null,
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
    logger.error({ err }, "Assign error");
    res.status(400).json({ message: err.message || "Failed to assign" });
  }
};

export const autoAssignIncident = async (req: Request, res: Response) => {
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
    logger.error({ err }, "Auto-assign error");
    res.status(400).json({ message: err.message || "Failed to auto-assign" });
  }
};
