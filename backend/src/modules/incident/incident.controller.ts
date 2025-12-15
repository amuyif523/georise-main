import type { Request, Response } from "express";
import { incidentService } from "./incident.service";
import sanitizeHtml from "sanitize-html";
import logger from "../../logger";
import { getIO } from "../../socket";

export const createIncident = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const sanitizedBody = {
      ...req.body,
      title: typeof req.body.title === "string" ? sanitizeHtml(req.body.title) : req.body.title,
      description:
        typeof req.body.description === "string" ? sanitizeHtml(req.body.description) : req.body.description,
    };

    const incident = await incidentService.createIncident(sanitizedBody, req.user.id);
    return res.status(201).json({ incident });
  } catch (err: any) {
    logger.error({ err }, "Create incident error");
    return res
      .status(400)
      .json({ message: err?.message || "Failed to create incident" });
  }
};

export const getMyIncidents = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const incidents = await incidentService.getMyIncidents(req.user.id);
    return res.json({ incidents });
  } catch (err: any) {
    logger.error({ err }, "Get my incidents error");
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch incidents" });
  }
};

export const getMyIncidentById = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const id = Number(req.params.id);
    const incident = await incidentService.getIncidentById(id, req.user.id);

    if (!incident) return res.status(404).json({ message: "Incident not found" });

    return res.json({ incident });
  } catch (err: any) {
    logger.error({ err }, "Get incident error");
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch incident" });
  }
};

export const checkDuplicates = async (req: Request, res: Response) => {
  try {
    const { lat, lng, title, description } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const duplicates = await incidentService.findPotentialDuplicates(
      Number(lat),
      Number(lng),
      title as string,
      description as string
    );
    return res.json({ duplicates });
  } catch (err: any) {
    logger.error({ err }, "Check duplicates error");
    return res.status(400).json({ message: "Failed to check duplicates" });
  }
};

export const mergeIncidents = async (req: Request, res: Response) => {
  try {
    const { primaryId, duplicateId } = req.body;
    if (!primaryId || !duplicateId) {
      return res.status(400).json({ message: "primaryId and duplicateId required" });
    }
    await incidentService.mergeIncidents(Number(primaryId), Number(duplicateId), req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Merge incidents error");
    return res.status(400).json({ message: "Failed to merge incidents" });
  }
};

export const shareIncident = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { agencyId, reason } = req.body;
    
    if (!agencyId || !reason) {
      return res.status(400).json({ message: "agencyId and reason required" });
    }

    const result = await incidentService.shareIncident(Number(incidentId), Number(agencyId), reason);
    return res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Share incident error");
    return res.status(400).json({ message: "Failed to share incident" });
  }
};

export const getIncidentChat = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const messages = await incidentService.getIncidentChat(Number(incidentId));
    return res.json({ messages });
  } catch (err: any) {
    logger.error({ err }, "Get chat error");
    return res.status(400).json({ message: "Failed to get chat" });
  }
};

export const postChatMessage = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { message } = req.body;
    
    if (!message) return res.status(400).json({ message: "Message required" });

    const chat = await incidentService.addChatMessage(Number(incidentId), req.user!.id, message);
    
    getIO().to(`incident:${incidentId}`).emit("incident:chat", chat);
    
    return res.json(chat);
  } catch (err: any) {
    logger.error({ err }, "Post chat error");
    return res.status(400).json({ message: "Failed to post message" });
  }
};
