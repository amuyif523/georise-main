import prisma from '../../prisma';
import * as turf from '@turf/turf';
import { ResponderStatus } from '@prisma/client';
import { routingService } from '../../services/routing.service';

interface DispatchCandidate {
  agencyId: number;
  agencyName: string;
  unitId: number | null;
  unitName: string | null;
  responderStatus: ResponderStatus | null;
  subCityName?: string | null;
  woredaName?: string | null;
  distanceKm: number | null;
  estimatedDurationMin?: number | null;
  jurisdictionScore: number;
  severityScore: number;
  proximityScore: number;
  statusScore: number;
  totalScore: number;
}

const normalize = (value: number | null, max: number) => {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
};

const haversineDistanceKm = (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(endLat - startLat);
  const dLon = toRadians(endLon - startLon);
  const originLat = toRadians(startLat);
  const destinationLat = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const statusScoreForResponder = (status: ResponderStatus | null) => {
  if (status === ResponderStatus.AVAILABLE) return 1;
  if (status === ResponderStatus.STANDBY) return 0.6;
  return 0;
};

export class DispatchService {
  async recommendForIncident(
    incidentId: number,
    scopedAgencyId?: number | null,
  ): Promise<DispatchCandidate[]> {
    const incidentRows: Array<{
      id: number;
      severityScore: number | null;
      latitude: number | null;
      longitude: number | null;
      declinedResponderIds: number[];
      location: unknown;
    }> = await prisma.$queryRaw`
      SELECT id,
             "severityScore",
             latitude,
             longitude,
             "declinedResponderIds",
             location
      FROM "Incident"
      WHERE id = ${incidentId}
      LIMIT 1
    `;

    const incident = incidentRows[0];
    if (!incident) {
      throw new Error('Incident not found');
    }

    const severityNorm = normalize(incident.severityScore ?? 3, 5);
    const agencies: Array<{ id: number; name: string; jurisdiction: unknown }> =
      await prisma.$queryRawUnsafe(
        `
          SELECT id, name, jurisdiction
          FROM "Agency"
          WHERE "isActive" = true
          ${scopedAgencyId ? `AND id = ${Number(scopedAgencyId)}` : ''}
        `,
      );

    const responders = await prisma.responder.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        status: { in: [ResponderStatus.AVAILABLE, ResponderStatus.STANDBY] },
        ...(scopedAgencyId ? { agencyId: scopedAgencyId } : {}),
      },
      select: {
        id: true,
        agencyId: true,
        name: true,
        status: true,
        latitude: true,
        longitude: true,
        subCity: { select: { name: true } },
        woreda: { select: { name: true } },
      },
    });

    const declinedResponderIds = incident.declinedResponderIds || [];
    const candidates: DispatchCandidate[] = [];

    for (const agency of agencies) {
      let inJurisdiction = false;
      if (agency.jurisdiction && incident.location) {
        const flag: Array<{ inside: boolean }> = await prisma.$queryRaw`
          SELECT ST_Contains(${agency.jurisdiction}::geometry, ${incident.location}::geometry) AS inside
        `;
        inJurisdiction = !!flag[0]?.inside;
      }

      const jurisdictionScore = inJurisdiction ? 1 : 0.5;
      const agencyResponders = responders.filter(
        (responder) =>
          responder.agencyId === agency.id && !declinedResponderIds.includes(responder.id),
      );

      for (const responder of agencyResponders) {
        let distanceKm: number | null = null;
        let estimatedDurationMin: number | null = null;

        if (
          incident.latitude !== null &&
          incident.longitude !== null &&
          responder.latitude !== null &&
          responder.longitude !== null
        ) {
          distanceKm = haversineDistanceKm(
            incident.latitude,
            incident.longitude,
            responder.latitude,
            responder.longitude,
          );

          try {
            const route = await routingService.calculateRoute(
              responder.latitude,
              responder.longitude,
              incident.latitude,
              incident.longitude,
            );
            estimatedDurationMin =
              route.distanceKm !== null
                ? route.durationMin
                : Math.max(1, Math.round((distanceKm / 35) * 60));
          } catch {
            estimatedDurationMin = Math.max(1, Math.round((distanceKm / 35) * 60));
          }
        }

        const proximityScore =
          distanceKm === null ? 0 : Math.max(0, 1 - Math.min(distanceKm, 10) / 10);
        const statusScore = statusScoreForResponder(responder.status);
        const totalScore = proximityScore * 0.6 + statusScore * 0.4;

        candidates.push({
          agencyId: agency.id,
          agencyName: agency.name,
          unitId: responder.id,
          unitName: responder.name,
          responderStatus: responder.status,
          subCityName: responder.subCity?.name ?? null,
          woredaName: responder.woreda?.name ?? null,
          distanceKm,
          estimatedDurationMin,
          jurisdictionScore,
          severityScore: severityNorm,
          proximityScore,
          statusScore,
          totalScore,
        });
      }
    }

    candidates.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }

      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;

      return a.distanceKm - b.distanceKm;
    });

    return candidates;
  }

  async executeAutoAssignment(incidentId: number) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { aiOutput: true },
    });

    if (!incident || incident.status !== 'RECEIVED') return null;
    if ((incident.severityScore ?? 0) < 5) return null;

    const recs = await this.recommendForIncident(incidentId);
    if (!recs.length) return null;

    const top = recs[0];
    if (top.unitId && top.distanceKm && top.distanceKm <= 2 && top.totalScore >= 0.75) {
      const unit = await prisma.responder.findUnique({ where: { id: top.unitId } });
      if (!unit || (unit.status !== 'AVAILABLE' && unit.status !== 'STANDBY')) return null;

      const updatedIncident = await prisma.incident.update({
        where: { id: incidentId },
        data: {
          assignedAgencyId: top.agencyId,
          assignedResponderId: top.unitId,
          status: 'ASSIGNED',
          dispatchedAt: new Date(),
        },
      });

      await prisma.responder.update({
        where: { id: top.unitId },
        data: { status: 'ASSIGNED' },
      });

      const { logActivity } = await import('../incident/activity.service');
      await logActivity(
        incidentId,
        'SYSTEM',
        `Auto-Pilot: Critical incident auto-assigned to ${unit.name} (${top.distanceKm.toFixed(1)}km)`,
      );

      const { emitIncidentUpdated, toIncidentPayload } =
        await import('../../events/incidentEvents');
      emitIncidentUpdated(toIncidentPayload(updatedIncident));

      const { pushService } = await import('../push/push.service');
      await pushService.notifyAssignment(updatedIncident, top.unitId);

      return { incident: updatedIncident, unit };
    }

    return null;
  }

  async assignIncident(
    incidentId: number,
    agencyId: number,
    unitId: number | null,
    actorId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const agencyResult: any[] = await tx.$queryRaw`
        SELECT jurisdiction FROM "Agency" WHERE id = ${agencyId}
      `;
      const agency = agencyResult[0];

      if (agency?.jurisdiction) {
        const incidentLoc = await tx.incident.findUnique({
          where: { id: incidentId },
          select: { latitude: true, longitude: true },
        });

        if (incidentLoc?.latitude && incidentLoc?.longitude) {
          const point = turf.point([incidentLoc.longitude, incidentLoc.latitude]);
          const poly = agency.jurisdiction as any;

          // @ts-ignore GeoJSON from Unsupported field
          const isInside = turf.booleanPointInPolygon(point, poly);
          if (!isInside) {
            throw new Error('Assignment failed: Incident is outside agency jurisdiction.');
          }
        }
      }

      if (unitId) {
        const responder = await tx.responder.findUnique({
          where: { id: unitId },
        });

        if (!responder) {
          throw new Error('Responder not found');
        }

        if (responder.status !== 'AVAILABLE' && responder.status !== 'STANDBY') {
          throw new Error(`Responder is currently ${responder.status} and cannot be assigned.`);
        }

        await tx.responder.update({
          where: { id: unitId },
          data: { status: 'ASSIGNED' },
        });
      }

      const incident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          assignedAgencyId: agencyId,
          assignedResponderId: unitId || null,
          status: 'ASSIGNED',
          dispatchedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DISPATCH_ASSIGN',
          targetType: 'Incident',
          targetId: incidentId,
          note: JSON.stringify({ agencyId, unitId }),
        },
      });

      return { incident, unitId };
    });
  }

  async acknowledgeAssignment(incidentId: number, responderId: number, actorUserId: number) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new Error('Incident not found');
    if (incident.assignedResponderId !== responderId) {
      throw new Error('Not assigned to this responder');
    }
    if (incident.acknowledgedAt) throw new Error('Already acknowledged');

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: { acknowledgedAt: new Date() },
    });

    const { logActivity } = await import('../incident/activity.service');
    await logActivity(incidentId, 'STATUS_CHANGE', 'Assignment Acknowledged', actorUserId);

    const { emitIncidentUpdated, toIncidentPayload } = await import('../../events/incidentEvents');
    emitIncidentUpdated(toIncidentPayload(updated));

    return updated;
  }

  async declineAssignment(
    incidentId: number,
    responderId: number,
    reason: string,
    actorUserId: number,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id: incidentId } });
      if (!incident) throw new Error('Incident not found');
      if (incident.assignedResponderId !== responderId) {
        throw new Error('Not assigned to this responder');
      }

      const newDeclinedIds = [...(incident.declinedResponderIds || []), responderId];

      const updatedIncident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: 'RECEIVED',
          assignedResponderId: null,
          assignedAgencyId: null,
          dispatchedAt: null,
          acknowledgedAt: null,
          declinedResponderIds: newDeclinedIds,
        },
      });

      await tx.responder.update({
        where: { id: responderId },
        data: { status: 'AVAILABLE' },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'DECLINE_ASSIGNMENT',
          targetType: 'Incident',
          targetId: incidentId,
          note: reason,
        },
      });

      await tx.activityLog.create({
        data: {
          incidentId,
          userId: actorUserId,
          type: 'STATUS_CHANGE',
          message: `Assignment Declined: ${reason}`,
        },
      });

      const { emitIncidentUpdated, toIncidentPayload } =
        await import('../../events/incidentEvents');
      emitIncidentUpdated(toIncidentPayload(updatedIncident));

      return updatedIncident;
    });

    try {
      await this.executeAutoAssignment(incidentId);
    } catch (err) {
      console.error('Failed to auto-reassign after decline:', err);
    }

    return result;
  }
}

export const dispatchService = new DispatchService();
