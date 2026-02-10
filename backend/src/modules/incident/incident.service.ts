import type { Express } from 'express';
import { IncidentStatus } from '@prisma/client';
import prisma from '../../prisma';
import redis from '../../redis';
import { CreateIncidentRequest } from './incident.types';
import {
  emitIncidentCreated,
  emitIncidentUpdated,
  toIncidentPayload,
} from '../../events/incidentEvents';
import { getIO } from '../../socket';
import { gisService } from '../gis/gis.service';
import { reputationService } from '../reputation/reputation.service';
import { logActivity } from './activity.service';
// import { smsService } from '../sms/sms.service';
import logger from '../../logger';
// import { metrics } from '../../metrics/metrics.service';
import { incidentQueue } from '../../jobs/queue';

const LOW_PRIORITY_CATEGORIES = ['INFRASTRUCTURE'];

export class IncidentService {
  async createIncident(data: CreateIncidentRequest, reporterId?: number, ipAddress?: string) {
    const crisisConfig = await prisma.systemConfig.findUnique({ where: { key: 'CRISIS_MODE' } });
    const crisisMode = crisisConfig?.value === 'true';
    const category = data.category?.toUpperCase();

    if (crisisMode && category && LOW_PRIORITY_CATEGORIES.includes(category)) {
      throw new Error('Crisis Mode active: low-priority reports are temporarily disabled.');
    }

    let user: any = null;

    if (reporterId) {
      // Anti-spam: limit burst submissions for users
      const recentCount = await prisma.incident.count({
        where: {
          reporterId,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });
      if (recentCount > 5) {
        throw new Error('Too many incident reports in a short time. Please wait a few minutes.');
      }

      user = await prisma.user.findUnique({
        where: { id: reporterId },
        select: {
          trustScore: true,
          lastReportAt: true,
          isShadowBanned: true,
          citizenVerification: { select: { status: true } },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user?.lastReportAt) {
        const diffMinutes = (Date.now() - user.lastReportAt.getTime()) / (60 * 1000);
        if (diffMinutes < 2 && (user.trustScore ?? 0) <= 0) {
          throw new Error('You are sending reports too frequently. Please wait a few minutes.');
        }
      }

      // Security Hardening (Sprint 6): Block Unverified Ghost Reporters
      if (user?.citizenVerification?.status !== 'VERIFIED' && (user?.trustScore ?? 0) < 50) {
        logger.warn(
          {
            userId: reporterId,
            trustScore: user?.trustScore,
            verificationStatus: user?.citizenVerification?.status,
          },
          'Security blocks report: Unverified ghost reporter',
        );
        throw new Error(
          'Account Verification Required: You must verify your account (National ID/Phone) before reporting incidents to ensure system integrity.',
        );
      }
    } else {
      // Guest Logic
      if (!ipAddress) {
        throw new Error('IP address required for guest submission');
      }

      const key = `rate_limit:guest_incident:${ipAddress}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 3600); // 1 hour
      }
      if (current > 5) {
        throw new Error('Too many guest submissions. Please try again later.');
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

    if (reporterId && user) {
      if (user.isShadowBanned) {
        reviewStatus = 'REJECTED';
      } else {
        const tier = await reputationService.getTier(reporterId);
        // Tier 3 (Gold/Trusted) bypasses review (FR-01)
        if (tier >= 3) {
          reviewStatus = 'APPROVED';
        } else if (tier === 0) {
          // Tier 0 (Unverified) always requires review
          reviewStatus = 'PENDING_REVIEW';
        }
      }
    } else {
      // Guest submissions always require review
      reviewStatus = 'PENDING_REVIEW';
    }

    const incident = await prisma.incident.create({
      data: {
        title: data.title,
        description: data.description,
        reporterId,
        latitude: data.latitude,
        longitude: data.longitude,
        subCityId,
        woredaId,
        status: IncidentStatus.RECEIVED,
        reviewStatus,
        isReporterAtScene: data.isReporterAtScene ?? true,
        severityScore: reporterId ? undefined : 1, // Default low severity for guests
      } as any,
    });

    // Populate geography column when coordinates are provided
    if (data.latitude != null && data.longitude != null) {
      await prisma.$executeRaw`
        UPDATE "Incident"
        SET location = ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)
        WHERE id = ${incident.id};
      `;
    }

    // Async AI Classification
    if (data.category !== 'INFRASTRUCTURE') {
      incidentQueue.add('analyze', {
        incidentId: incident.id,
        title: incident.title,
        description: incident.description,
        reporterId: reporterId || 0, // Pass 0 or handle null in worker if acceptable, but worker might expect number
      });
    } else {
      const aiOutput = {
        predicted_category: 'INFRASTRUCTURE',
        severity_score: 1,
        confidence: 1.0,
        model_version: 'manual',
        summary: null,
      };
      await prisma.incident.update({
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
      });
    }

    if (reporterId) {
      await logActivity(incident.id, 'SYSTEM', 'Incident created', reporterId as number);
      if (reviewStatus === 'PENDING_REVIEW') {
        await logActivity(
          incident.id,
          'STATUS_CHANGE',
          'Incident marked for review',
          reporterId as number,
        );
      }
      await reputationService.onIncidentCreated(reporterId as number);
    }

    if (reviewStatus !== 'PENDING_REVIEW') {
      // Emit initial creation event
      const fresh = await prisma.incident.findUnique({
        where: { id: incident.id },
        include: { aiOutput: true },
      });
      emitIncidentCreated(toIncidentPayload(fresh || incident));
    } else {
      // Logic Audit Fix: Ensure PENDING items are visible to agencies
      const fresh = await prisma.incident.findUnique({
        where: { id: incident.id },
        include: { aiOutput: true },
      });
      const { emitPendingIncidentToAgencies } = await import('../../events/incidentEvents');
      emitPendingIncidentToAgencies(toIncidentPayload(fresh || incident));
    }
    return incident;
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
        AND status NOT IN ('RESOLVED', 'CANCELLED')
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

  async shareIncident(
    incidentId: number,
    targetAgencyId: number,
    sharedByUserId: number,
    reason?: string,
    note?: string,
  ) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new Error('Incident not found');

    const agency = await prisma.agency.findUnique({ where: { id: targetAgencyId } });
    if (!agency) throw new Error('Target agency not found');

    // Check if already shared
    const existing = await prisma.sharedIncident.findUnique({
      where: {
        incidentId_agencyId: {
          incidentId,
          agencyId: targetAgencyId,
        },
      },
    });

    if (existing) {
      throw new Error('Incident already shared with this agency');
    }

    const shared = await prisma.sharedIncident.create({
      data: {
        incidentId,
        agencyId: targetAgencyId,
        reason,
      },
    });

    // Log activity
    await logActivity(
      incidentId,
      'SYSTEM', // or ASSIGNMENT?
      `Incident shared with ${agency.name}. Reason: ${reason || 'No reason provided'}`,
      sharedByUserId,
    );

    // Audit log (state change) is handled by middleware if calls controller, but internal service calls might need explicit audit?
    // The controller calls this, so middleware catches the route. But specific "shared" audit might be good.
    // However, middleware handles generic audit.

    // Emit event
    const payload = toIncidentPayload(incident);
    // We need to import emitIncidentShared. It was added in incidentEvents.ts
    const { emitIncidentShared } = await import('../../events/incidentEvents');
    emitIncidentShared(payload, targetAgencyId);

    return shared;
  }
}

export const incidentService = new IncidentService();
