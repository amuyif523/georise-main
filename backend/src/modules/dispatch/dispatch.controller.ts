import type { Request, Response } from 'express';
import prisma from '../../prisma';
import { dispatchService } from './dispatch.service';
import { pushService } from '../push/push.service';
import { IncidentStatus } from '@prisma/client';
import logger from '../../logger';
import type { Prisma } from '@prisma/client';

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.incidentId);
    const recs = await dispatchService.recommendForIncident(id);
    res.json(recs);
  } catch (err: any) {
    logger.error({ err }, 'Recommendation error');
    res.status(400).json({ message: err.message || 'Failed to get recommendations' });
  }
};

export const assignIncident = async (req: Request, res: Response) => {
  try {
    const { incidentId, agencyId, unitId } = req.body;
    if (!incidentId || !agencyId) {
      return res.status(400).json({ message: 'incidentId and agencyId are required' });
    }

    const { incident } = await dispatchService.assignIncident(
      incidentId,
      agencyId,
      unitId,
      req.user!.id,
    );

    if (unitId) {
      // Notify Responder
      await pushService.notifyAssignment(incident, unitId);
    }

    res.json({ incident });
  } catch (err: any) {
    logger.error({ err }, 'Assign error');
    res.status(400).json({ message: err.message || 'Failed to assign' });
  }
};

export const autoAssignIncident = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.incidentId);
    const recs = await dispatchService.recommendForIncident(id);
    if (!recs.length) return res.status(400).json({ message: 'No candidates found' });

    const top = recs[0];
    const incident = await prisma.incident.update({
      where: { id },
      data: {
        assignedAgencyId: top.agencyId,
        assignedResponderId: top.unitId || null,
        status: IncidentStatus.ASSIGNED,
      },
    });

    if (top.unitId) {
      await prisma.responder.update({
        where: { id: top.unitId },
        data: { status: 'ASSIGNED' },
      });
      // Notify Responder
      await pushService.notifyAssignment(incident, top.unitId);
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'DISPATCH_AUTO_ASSIGN',
        targetType: 'Incident',
        targetId: id,
        note: JSON.stringify({
          agencyId: top.agencyId,
          unitId: top.unitId ?? null,
          score: top.totalScore ?? null,
        } satisfies Record<string, Prisma.JsonValue>),
      },
    });

    return res.json({ incident, selected: top });
  } catch (err: any) {
    logger.error({ err }, 'Auto-assign error');
    return res.status(400).json({ message: err.message || 'Failed to auto-assign' });
  }
};

export const acknowledgeIncident = async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.body;
    if (!incidentId) return res.status(400).json({ message: 'incidentId required' });

    // Find responder profile for current user
    const responder = await prisma.responder.findFirst({
      where: { userId: req.user!.id },
    });
    if (!responder) return res.status(403).json({ message: 'User is not a responder' });

    await dispatchService.acknowledgeAssignment(Number(incidentId), responder.id, req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Acknowledge error');
    return res.status(400).json({ message: err.message || 'Failed to acknowledge' });
  }
};

export const declineIncident = async (req: Request, res: Response) => {
  try {
    const { incidentId, reason } = req.body;
    if (!incidentId || !reason)
      return res.status(400).json({ message: 'incidentId and reason required' });

    const responder = await prisma.responder.findFirst({
      where: { userId: req.user!.id },
    });
    if (!responder) return res.status(403).json({ message: 'User is not a responder' });

    await dispatchService.declineAssignment(Number(incidentId), responder.id, reason, req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Decline error');
    return res.status(400).json({ message: err.message || 'Failed to decline' });
  }
};
