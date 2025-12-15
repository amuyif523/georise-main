import type { Request, Response } from "express";
import { incidentService } from "./incident.service";
import sanitizeHtml from "sanitize-html";
import logger from "../../logger";

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
