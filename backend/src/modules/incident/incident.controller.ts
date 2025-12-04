import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { incidentService } from "./incident.service";

export const createIncident = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const incident = await incidentService.createIncident(req.body, req.user.id);
    return res.status(201).json({ incident });
  } catch (err: any) {
    console.error("Create incident error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Failed to create incident" });
  }
};

export const getMyIncidents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const incidents = await incidentService.getMyIncidents(req.user.id);
    return res.json({ incidents });
  } catch (err: any) {
    console.error("Get my incidents error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch incidents" });
  }
};

export const getMyIncidentById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const id = Number(req.params.id);
    const incident = await incidentService.getIncidentById(id, req.user.id);

    if (!incident) return res.status(404).json({ message: "Incident not found" });

    return res.json({ incident });
  } catch (err: any) {
    console.error("Get incident error:", err);
    return res
      .status(400)
      .json({ message: err?.message || "Failed to fetch incident" });
  }
};
