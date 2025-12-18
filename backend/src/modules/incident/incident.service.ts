import axios from 'axios';
import type { Express } from 'express';
import { IncidentStatus } from '@prisma/client';
import prisma from '../../prisma';
import { CreateIncidentRequest } from './incident.types';
import {
  emitIncidentCreated,
  emitIncidentUpdated,
  toIncidentPayload,
} from '../../events/incidentEvents';
import { gisService } from '../gis/gis.service';
import { reputationService } from '../reputation/reputation.service';
import { logActivity } from './activity.service';
import { smsService } from '../sms/sms.service';
import logger from '../../logger';

const AI_ENDPOINT = process.env.AI_ENDPOINT || 'http://localhost:8001/classify';

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
      throw new Error('Too many incident reports in a short time. Please wait a few minutes.');
    }

    const user = await prisma.user.findUnique({
      where: { id: reporterId },
      select: {
        trustScore: true,
        lastReportAt: true,
        isShadowBanned: true,
        citizenVerification: { select: { status: true } },
      },
    });
    if (user?.lastReportAt) {
      const diffMinutes = (Date.now() - user.lastReportAt.getTime()) / (60 * 1000);
      if (diffMinutes < 2 && (user.trustScore ?? 0) <= 0) {
        throw new Error('You are sending reports too frequently. Please wait a few minutes.');
      }
    }

    let subCityId: number | undefined;
    let woredaId: number | undefined;
    if (data.latitude != null && data.longitude != null) {
      const areas = await gisService.findAdministrativeAreaForPoint(data.latitude, data.longitude);
      if (areas.subCity) subCityId = areas.subCity.id;
      if (areas.woreda) woredaId = areas.woreda.id;
    }

    let reviewStatus: any = 'NOT_REQUIRED';

    if (user?.isShadowBanned) {
      reviewStatus = 'REJECTED';
    } else {
      const tier = await reputationService.getTier(reporterId);
      // Tier 0 (Unverified) always requires review
      if (tier === 0) {
        reviewStatus = 'PENDING_REVIEW';
      }
    }

    const incident = await prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        reporterId,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        subCityId,
        woredaId,
        status: IncidentStatus.RECEIVED,
        reviewStatus,
        isReporterAtScene: data.isReporterAtScene ?? true,
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

    // If category is manually provided (e.g. INFRASTRUCTURE), skip AI or use it only for summary
    if (data.category === 'INFRASTRUCTURE') {
      aiOutput = {
        predicted_category: 'INFRASTRUCTURE',
        severity_score: 1, // Low severity for hazards
        confidence: 1.0,
        model_version: 'manual',
        summary: null,
      };
    } else {
      try {
        const res = await axios.post(AI_ENDPOINT, {
          title: incident.title,
          description: incident.description,
        });
        aiOutput = res.data;
      } catch (err) {
        logger.error({ err }, 'AI classification failed, using fallback');
        aiOutput = {
          predicted_category: 'UNSPECIFIED',
          severity_score: 2,
          confidence: 0,
          model_version: 'stub-v0',
          summary: null,
        };
      }
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

    await logActivity(incident.id, 'SYSTEM', 'Incident created', reporterId);
    if (reviewStatus === 'PENDING_REVIEW') {
      await logActivity(incident.id, 'STATUS_CHANGE', 'Incident marked for review', reporterId);
    }

    await reputationService.onIncidentCreated(reporterId);
    if (reviewStatus !== 'PENDING_REVIEW') {
      emitIncidentCreated(toIncidentPayload(updated));

      // Critical Alert Fallback (SMS)
      // If severity > 4 (High/Critical), notify admins/responders via SMS if needed
      // For now, we simulate notifying the reporter that help is on the way if it's high severity
      if (updated.severityScore && updated.severityScore >= 4) {
        const reporter = await prisma.user.findUnique({ where: { id: reporterId } });
        if (reporter?.phone) {
          // In a real scenario, we'd check if they have push notifications enabled first
          // Here we just simulate the fallback logic
          await smsService.sendSMS(
            reporter.phone,
            `GEORISE Alert: Your report #${updated.id} is marked as HIGH severity. Responders are being notified.`,
          );
        }
      }
    }
    return updated;
  }

  async getMyIncidents(reporterId: number) {
    const incidents = await prisma.incident.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      include: { aiOutput: true },
    });
    return incidents;
  }

  async getIncidentById(id: number, reporterId: number) {
    const incident = await prisma.incident.findFirst({
      where: { id, reporterId },
      include: { aiOutput: true, statusHistory: true, photos: true },
    });
    return incident;
  }

  async findPotentialDuplicates(lat: number, lng: number, title?: string, description?: string) {
    // 200 meters radius, last 2 hours
    const radius = 200;
    const timeWindow = 2 * 60 * 60 * 1000; // 2 hours in ms
    const since = new Date(Date.now() - timeWindow);

    const duplicates = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, title, description, category, "severityScore", status, "createdAt",
             ST_Distance(
               location::geography,
               ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
             ) as distance
      FROM "Incident"
      WHERE location IS NOT NULL
        AND "createdAt" >= '${since.toISOString()}'
        AND status NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED')
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radius}
        )
      ORDER BY distance ASC
      LIMIT 10
    `);

    if (title || description) {
      const targetText = ((title || '') + ' ' + (description || '')).toLowerCase();
      duplicates.forEach((d) => {
        const otherText = ((d.title || '') + ' ' + (d.description || '')).toLowerCase();
        d.similarity = this.calculateSimilarity(targetText, otherText);
      });
      // Sort by similarity descending, then distance ascending
      duplicates.sort((a, b) => {
        if (Math.abs(b.similarity - a.similarity) > 0.1) {
          return b.similarity - a.similarity;
        }
        return a.distance - b.distance;
      });
    }

    return duplicates.slice(0, 5);
  }

  private calculateSimilarity(s1: string, s2: string) {
    const w1 = s1.match(/\w+/g) || [];
    const w2 = s2.match(/\w+/g) || [];
    const set1 = new Set(w1);
    const set2 = new Set(w2);
    const intersection = [...set1].filter((x) => set2.has(x)).length;
    const union = new Set([...w1, ...w2]).size;
    return union === 0 ? 0 : intersection / union;
  }

  async mergeIncidents(primaryId: number, duplicateId: number, agencyUserId: number) {
    const duplicate = await prisma.incident.findUnique({ where: { id: duplicateId } });
    if (!duplicate) throw new Error('Duplicate incident not found');

    // Mark duplicate as resolved (merged)
    await prisma.incident.update({
      where: { id: duplicateId },
      data: {
        status: 'RESOLVED', // Or a specific MERGED status if enum allows, using RESOLVED for now
        reviewStatus: 'APPROVED',
      },
    });

    // Log activity on both
    await logActivity(primaryId, 'SYSTEM', `Merged with incident #${duplicateId}`, agencyUserId);
    await logActivity(
      duplicateId,
      'STATUS_CHANGE',
      `Merged into incident #${primaryId}`,
      agencyUserId,
    );

    // Emit update
    emitIncidentUpdated(
      toIncidentPayload((await prisma.incident.findUnique({ where: { id: duplicateId } })) as any),
    );

    return true;
  }

  async shareIncident(incidentId: number, agencyId: number, reason: string) {
    const existing = await prisma.sharedIncident.findUnique({
      where: {
        incidentId_agencyId: { incidentId, agencyId },
      },
    });

    if (existing) return existing;

    const shared = await prisma.sharedIncident.create({
      data: {
        incidentId,
        agencyId,
        reason,
      },
      include: { agency: true },
    });

    await logActivity(
      incidentId,
      'SYSTEM',
      `Incident shared with ${shared.agency.name}: ${reason}`,
    );

    // Emit update
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (incident) emitIncidentUpdated(toIncidentPayload(incident));

    return shared;
  }

  async getIncidentChat(incidentId: number) {
    return prisma.incidentChat.findMany({
      where: { incidentId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            agencyStaff: { include: { agency: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addChatMessage(incidentId: number, senderId: number, message: string) {
    const chat = await prisma.incidentChat.create({
      data: {
        incidentId,
        senderId,
        message,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
            agencyStaff: { include: { agency: true } },
          },
        },
      },
    });

    return chat;
  }

  async addIncidentPhoto(incidentId: number, uploadedById: number, file: Express.Multer.File) {
    return prisma.incidentPhoto.create({
      data: {
        incidentId,
        uploadedById,
        url: `/uploads/incident-photos/${file.filename}`,
        storagePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      },
    });
  }

  async getIncidentPhotos(incidentId: number) {
    return prisma.incidentPhoto.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const incidentService = new IncidentService();
