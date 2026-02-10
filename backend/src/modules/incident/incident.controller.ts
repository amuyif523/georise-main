import type { Request, Response } from 'express';
import { incidentService } from './incident.service';
import sanitizeHtml from 'sanitize-html';
import logger from '../../logger';
import { getIO } from '../../socket';
import prisma from '../../prisma';
import { Role } from '@prisma/client';

export const createIncident = async (req: Request, res: Response) => {
  try {
    const sanitizedBody = {
      ...req.body,
      title: typeof req.body.title === 'string' ? sanitizeHtml(req.body.title) : req.body.title,
      description:
        typeof req.body.description === 'string'
          ? sanitizeHtml(req.body.description)
          : req.body.description,
    };

    const incident = await incidentService.createIncident(
      sanitizedBody,
      req.user?.id,
      req.ip || req.socket.remoteAddress,
    );
    return res.status(201).json({ incident });
  } catch (err: any) {
    console.log('Create Incident Failed. Request Body:', JSON.stringify(req.body, null, 2));
    if (err.issues) {
      console.log('Zod Validation Errors:', JSON.stringify(err.issues, null, 2));
    } else {
      console.log('Error Details:', err);
    }
    logger.error({ err }, 'Create incident error');
    // Extract Zod error messages if available
    const msg = err.issues
      ? JSON.stringify(err.issues)
      : err?.message || 'Failed to create incident';
    return res.status(400).json({ message: msg });
  }
};

export const getMyIncidents = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const incidents = await incidentService.getMyIncidents(req.user.id);
    return res.json({ incidents });
  } catch (err: any) {
    logger.error({ err }, 'Get my incidents error');
    return res.status(400).json({ message: err?.message || 'Failed to fetch incidents' });
  }
};

export const getMyIncidentById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const id = Number(req.params.id);
    const incident = await incidentService.getIncidentById(id, req.user.id);

    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    return res.json({ incident });
  } catch (err: any) {
    logger.error({ err }, 'Get incident error');
    return res.status(400).json({ message: err?.message || 'Failed to fetch incident' });
  }
};

export const checkDuplicates = async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const title = typeof req.query.title === 'string' ? req.query.title : '';
    const description = typeof req.query.description === 'string' ? req.query.description : '';

    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    const duplicates = await incidentService.findPotentialDuplicates(lat, lng, title, description);
    return res.json({ duplicates });
  } catch (err: any) {
    logger.error({ err }, 'Check duplicates error');
    return res.status(400).json({ message: 'Failed to check duplicates' });
  }
};

export const mergeIncidents = async (req: Request, res: Response) => {
  try {
    const { primaryId, duplicateId } = req.body;
    if (!primaryId || !duplicateId) {
      return res.status(400).json({ message: 'primaryId and duplicateId required' });
    }
    await incidentService.mergeIncidents(Number(primaryId), Number(duplicateId), req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Merge incidents error');
    return res.status(400).json({ message: 'Failed to merge incidents' });
  }
};

export const shareIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetAgencyId, reason, note } = req.body;

    if (!targetAgencyId) {
      return res.status(400).json({ message: 'Target agency ID is required' });
    }

    const shared = await incidentService.shareIncident(
      Number(id),
      Number(targetAgencyId),
      req.user!.id,
      reason,
      note,
    );
    return res.status(200).json(shared);
  } catch (err: any) {
    logger.error({ err }, 'Share incident error');
    return res.status(400).json({ message: 'Failed to share incident' });
  }
};

export const getIncidentChat = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const messages = await incidentService.getIncidentChat(Number(incidentId));
    return res.json({ messages });
  } catch (err: any) {
    logger.error({ err }, 'Get chat error');
    return res.status(400).json({ message: 'Failed to get chat' });
  }
};

export const postChatMessage = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ message: 'Message required' });

    const chat = await incidentService.addChatMessage(Number(incidentId), req.user!.id, message);

    getIO().to(`incident:${incidentId}`).emit('incident:chat', chat);

    return res.json(chat);
  } catch (err: any) {
    logger.error({ err }, 'Post chat error');
    return res.status(400).json({ message: 'Failed to post message' });
  }
};

const canAccessIncident = async (incidentId: number, user: any) => {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { reporterId: true },
  });
  if (!incident) {
    throw new Error('Incident not found');
  }
  if (user.role === Role.CITIZEN && incident.reporterId !== user.id) {
    const err: any = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return incident;
};

export const uploadIncidentPhoto = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const incidentId = Number(req.params.id);
    await canAccessIncident(incidentId, req.user);

    if (!req.file) return res.status(400).json({ message: 'photo file is required' });

    const photo = await incidentService.addIncidentPhoto(incidentId, req.user.id, req.file);
    res.status(201).json({ photo });
  } catch (err: any) {
    logger.error({ err }, 'Upload incident photo failed');
    res.status(err?.status || 400).json({ message: err?.message || 'Failed to upload photo' });
  }
};

export const getIncidentPhotos = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const incidentId = Number(req.params.id);
    await canAccessIncident(incidentId, req.user);

    const photos = await incidentService.getIncidentPhotos(incidentId);
    res.json({ photos });
  } catch (err: any) {
    logger.error({ err }, 'Fetch incident photos failed');
    res.status(err?.status || 400).json({ message: err?.message || 'Failed to fetch photos' });
  }
};

export const getIncidents = async (req: Request, res: Response) => {
  try {
    let agencyId: number | null = null;
    if (req.user?.role === Role.AGENCY_STAFF) {
      const staff = await prisma.agencyStaff.findUnique({
        where: { userId: req.user.id },
        select: { agencyId: true },
      });
      if (!staff) return res.status(403).json({ message: 'Forbidden' });
      agencyId = staff.agencyId;
    }

    const { status, hours, reviewStatus, search } = req.query;
    const conditions: any = {}; // Using any to avoid complex Prisma type casting for now, or import Prisma

    // Status Filter
    if (status && typeof status === 'string') conditions.status = status;

    // Review Status Filter
    if (reviewStatus && typeof reviewStatus === 'string') {
      conditions.reviewStatus = reviewStatus;
    }

    // Time Filter
    const createdAtFilter =
      hours && Number(hours)
        ? {
            gte: new Date(Date.now() - Number(hours) * 3600 * 1000),
          }
        : undefined;
    if (createdAtFilter) {
      conditions.createdAt = createdAtFilter;
    }

    // SubCity Filter
    if (req.query.subCityId) {
      conditions.subCityId = Number(req.query.subCityId);
    }

    // Search Filter
    if (search && typeof search === 'string') {
      conditions.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Role-based Isolation
    if (req.user?.role === Role.ADMIN) {
      // Admin sees all
    } else if (agencyId) {
      // Enforce agency isolation: incidents assigned to OR shared with this agency
      // Explicitly ensuring top-level OR is handled if search uses OR
      if (conditions.OR) {
        conditions.AND = [
          { OR: conditions.OR },
          { OR: [{ assignedAgencyId: agencyId }, { sharedWith: { some: { agencyId } } }] },
        ];
        delete conditions.OR;
      } else {
        conditions.OR = [{ assignedAgencyId: agencyId }, { sharedWith: { some: { agencyId } } }];
      }
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const baseSelect = {
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
      assignedAgencyId: true,
      sharedWith: { select: { agencyId: true } },
    };

    const [total, incidents] = await Promise.all([
      prisma.incident.count({ where: conditions }),
      prisma.incident.findMany({
        where: conditions,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select:
          req.user?.role === Role.ADMIN
            ? {
                ...baseSelect,
                reporter: {
                  select: { id: true, fullName: true, trustScore: true, email: true, phone: true },
                },
              }
            : baseSelect,
      }),
    ]);

    return res.json({ total, page, limit, incidents });
  } catch (err: any) {
    console.error('List incidents error:', err);
    return res.status(400).json({ message: err?.message || 'Failed to fetch incidents' });
  }
};
