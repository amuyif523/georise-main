import axios from "axios";
import { IncidentStatus } from "@prisma/client";
import prisma from "../../prisma";
import { CreateIncidentRequest } from "./incident.types";

const AI_ENDPOINT = process.env.AI_ENDPOINT || "http://localhost:8001/classify";

export class IncidentService {
  async createIncident(data: CreateIncidentRequest, reporterId: number) {
    // Anti-spam: limit burst submissions
    const recentCount = await prisma.incident.count({
      where: {
        reporterId,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentCount > 5) {
      throw new Error("Too many incident reports in a short time. Please wait a few minutes.");
    }

    const incident = await prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        reporterId,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        status: IncidentStatus.RECEIVED,
      },
    });

    // Populate geography column when coordinates are provided
    if (data.latitude != null && data.longitude != null) {
      await prisma.$executeRaw`
        UPDATE "Incident"
        SET location = ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)
        WHERE id = ${incident.id};
      `;
    }

    let aiOutput: any = null;
    try {
      const res = await axios.post(AI_ENDPOINT, {
        title: incident.title,
        description: incident.description,
      });
      aiOutput = res.data;
    } catch (err) {
      console.error("AI classification failed, using fallback:", err);
      aiOutput = {
        predicted_category: "UNSPECIFIED",
        severity_score: 2,
        confidence: 0,
        model_version: "stub-v0",
        summary: null,
      };
    }

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        category: aiOutput.predicted_category,
        severityScore: aiOutput.severity_score,
        aiOutput: {
          create: {
            modelVersion: aiOutput.model_version,
            predictedCategory: aiOutput.predicted_category,
            severityScore: aiOutput.severity_score,
            confidence: aiOutput.confidence,
            summary: aiOutput.summary,
          },
        },
      },
      include: { aiOutput: true },
    });

    return updated;
  }

  async getMyIncidents(reporterId: number) {
    const incidents = await prisma.incident.findMany({
      where: { reporterId },
      orderBy: { createdAt: "desc" },
      include: { aiOutput: true },
    });
    return incidents;
  }

  async getIncidentById(id: number, reporterId: number) {
    const incident = await prisma.incident.findFirst({
      where: { id, reporterId },
      include: { aiOutput: true, statusHistory: true },
    });
    return incident;
  }
}

export const incidentService = new IncidentService();
