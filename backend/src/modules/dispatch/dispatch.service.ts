import prisma from '../../prisma';
import { routingService } from '../gis/routing.service';

interface DispatchCandidate {
  agencyId: number;
  unitId: number | null;
  distanceKm: number | null;
  estimatedDurationMin?: number | null;
  jurisdictionScore: number;
  severityScore: number;
  proximityScore: number;
  totalScore: number;
}

const normalize = (value: number | null, max: number) => {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
};

const categoryPreferred = (category?: string | null, agencyType?: string | null): number => {
  if (!category || !agencyType) return 0;
  const cat = category.toLowerCase();
  const type = agencyType.toLowerCase();
  if (type === 'fire' && (cat.includes('fire') || cat.includes('smoke'))) return 0.2;
  if (
    type === 'medical' &&
    (cat.includes('medical') || cat.includes('injury') || cat.includes('ambulance'))
  )
    return 0.2;
  if (
    type === 'police' &&
    (cat.includes('crime') || cat.includes('assault') || cat.includes('robbery'))
  )
    return 0.15;
  if (
    type === 'traffic' &&
    (cat.includes('traffic') || cat.includes('accident') || cat.includes('crash'))
  )
    return 0.15;

  // Infrastructure routing
  if (
    cat === 'infrastructure' ||
    cat.includes('hazard') ||
    cat.includes('pothole') ||
    cat.includes('light')
  ) {
    if (
      type === 'construction' ||
      type === 'electric' ||
      type === 'water' ||
      type === 'administration'
    )
      return 0.3;
  }

  return 0;
};

export class DispatchService {
  async recommendForIncident(incidentId: number): Promise<DispatchCandidate[]> {
    const incidentRows: any[] = await prisma.$queryRaw`
      SELECT id,
             "severityScore",
             location,
             latitude,
             longitude,
             category
      FROM "Incident"
      WHERE id = ${incidentId}
      LIMIT 1;
    `;
    if (!incidentRows.length) {
      throw new Error('Incident not found');
    }
    const incident = incidentRows[0];
    const severityNorm = normalize(incident.severityscore ?? 3, 5);

    // load agencies with optional jurisdiction geometry
    const agencies: any[] = await prisma.$queryRaw`
      SELECT id,
             name,
             type,
             jurisdiction
      FROM "Agency"
      WHERE "isActive" = true
    `;

    // load available units with last known position
    let units: any[] = [];

    if (incident.location) {
      units = await prisma.$queryRaw`
        SELECT u.id,
               u."agencyId",
               u.name,
               u.status,
               u.latitude as "lastLat",
               u.longitude as "lastLon",
               ST_DistanceSphere(
                 ST_SetSRID(ST_MakePoint(u.longitude, u.latitude), 4326),
                 ${incident.location}
               ) / 1000 AS distance_km
        FROM "Responder" u
        WHERE u.status::text = 'AVAILABLE'
          AND u.latitude IS NOT NULL 
          AND u.longitude IS NOT NULL;
      `;
    } else {
      // Fallback if incident has no location: just get available units
      units = await prisma.$queryRaw`
        SELECT u.id,
               u."agencyId",
               u.name,
               u.status,
               u.latitude as "lastLat",
               u.longitude as "lastLon",
               NULL as distance_km
        FROM "Responder" u
        WHERE u.status::text = 'AVAILABLE';
      `;
    }

    const candidates: DispatchCandidate[] = [];

    for (const agency of agencies) {
      // jurisdiction check if geometry available
      let inJurisdiction = false;
      if (agency.jurisdiction && incident.location) {
        const flag: any[] = await prisma.$queryRaw`
          SELECT ST_Contains(${agency.jurisdiction}::geometry, ${incident.location}::geometry) AS inside
        `;
        inJurisdiction = !!flag[0]?.inside;
      }
      const jurisdictionScore = inJurisdiction ? 1 : 0.5;
      const agencyUnits = units.filter((u) => u.agencyid === agency.id || u.agencyId === agency.id);

      if (!agencyUnits.length) {
        const catBonus = categoryPreferred(incident.category, agency.type);
        const totalScore = jurisdictionScore * 0.5 + severityNorm * 0.4 + catBonus;
        candidates.push({
          agencyId: agency.id,
          unitId: null,
          distanceKm: null,
          jurisdictionScore,
          severityScore: severityNorm,
          proximityScore: 0,
          totalScore,
        });
        continue;
      }

      for (const unit of agencyUnits) {
        const straightLineKm = unit.distance_km as number | null;

        // Calculate drive-time and road distance via routing provider (cached with fallback)
        let durationMin = 0;
        let distanceKm = straightLineKm;
        if (
          incident.location &&
          incident.latitude &&
          incident.longitude &&
          unit.lastLat &&
          unit.lastLon
        ) {
          const route = await routingService.calculateRoute(
            unit.lastLat,
            unit.lastLon,
            incident.latitude,
            incident.longitude,
          );
          durationMin = route.durationMin;
          distanceKm = route.distanceKm ?? straightLineKm;
        }

        const proximityScore = 1 - normalize(distanceKm, 15); // 15km cap
        const catBonus = categoryPreferred(incident.category, agency.type);

        // Adjust score based on duration (shorter is better)
        // If duration > 30 mins, penalty
        const durationPenalty = durationMin > 30 ? 0.2 : 0;

        const totalScore =
          jurisdictionScore * 0.35 +
          severityNorm * 0.3 +
          proximityScore * 0.25 +
          catBonus -
          durationPenalty;
        candidates.push({
          agencyId: agency.id,
          unitId: unit.id,
          distanceKm,
          estimatedDurationMin: durationMin,
          jurisdictionScore,
          severityScore: severityNorm,
          proximityScore,
          totalScore,
        });
      }
    }

    candidates.sort((a, b) => b.totalScore - a.totalScore);
    return candidates;
  }

  async executeAutoAssignment(incidentId: number) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { aiOutput: true },
    });

    if (!incident || incident.status !== 'RECEIVED') return null;

    // Auto-pilot trigger conditions: Critical severity (5)
    if ((incident.severityScore ?? 0) < 5) return null;

    const recs = await this.recommendForIncident(incidentId);
    if (!recs.length) return null;

    const top = recs[0];

    // High confidence threshold for auto-pilot:
    // 1. Top candidate has a specific unit assigned
    // 2. Unit is within 2km
    // 3. Top candidate is highly suitable (totalScore > 0.75)
    if (top.unitId && top.distanceKm && top.distanceKm <= 2 && top.totalScore >= 0.75) {
      const unit = await prisma.responder.findUnique({ where: { id: top.unitId } });
      if (!unit || unit.status !== 'AVAILABLE') return null;

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
      // 1. Validation for Responder
      if (unitId) {
        const responder = await tx.responder.findUnique({
          where: { id: unitId },
        });

        if (!responder) {
          throw new Error('Responder not found');
        }

        if (responder.status !== 'AVAILABLE') {
          throw new Error(`Responder is currently ${responder.status} and cannot be assigned.`);
        }

        // 2. Lock & Update Responder
        await tx.responder.update({
          where: { id: unitId },
          data: { status: 'ASSIGNED' },
        });
      }

      // 3. Update Incident
      const incident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          assignedAgencyId: agencyId,
          assignedResponderId: unitId || null,
          status: 'ASSIGNED',
          dispatchedAt: new Date(),
        },
      });

      // 4. Create Audit Log
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
    if (incident.assignedResponderId !== responderId)
      throw new Error('Not assigned to this responder');
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
    return prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id: incidentId } });
      if (!incident) throw new Error('Incident not found');
      if (incident.assignedResponderId !== responderId)
        throw new Error('Not assigned to this responder');

      // 1. Reset Incident
      const updatedIncident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: 'RECEIVED',
          assignedResponderId: null,
          assignedAgencyId: null, // Returning to general pool? Or should we keep agency?
          // If we keep agency, it's still assigned to agency but unassigned to responder.
          // But user requirement says "move incident back to RECEIVED queue".
          // RECEIVED usually implies "New / Unassigned".
          // I'll stick to RECEIVED and clear assignments.
          dispatchedAt: null,
          acknowledgedAt: null,
        },
      });

      // 2. Reset Responder
      await tx.responder.update({
        where: { id: responderId },
        data: { status: 'AVAILABLE' },
      });

      // 3. Log
      await tx.auditLog.create({
        data: {
          actorId: actorUserId,
          action: 'DECLINE_ASSIGNMENT',
          targetType: 'Incident',
          targetId: incidentId,
          note: reason,
        },
      });

      const { logActivity } = await import('../incident/activity.service');
      // We can't use the imported service easily inside transaction if it uses global prisma,
      // but activity service usually just does prisma.activityLog.create.
      // Ideally we'd use the tx here.
      // I'll manually create the activity log to be safe in transaction.
      await tx.activityLog.create({
        data: {
          incidentId,
          userId: actorUserId,
          type: 'STATUS_CHANGE', // or DISPATCH?
          message: `Assignment Declined: ${reason}`,
        },
      });

      const { emitIncidentUpdated, toIncidentPayload } =
        await import('../../events/incidentEvents');
      emitIncidentUpdated(toIncidentPayload(updatedIncident));

      return updatedIncident;
    });
  }
}

export const dispatchService = new DispatchService();
