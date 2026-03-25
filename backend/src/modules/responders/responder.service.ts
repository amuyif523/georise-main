import { ResponderStatus } from '@prisma/client';
import prisma from '../../prisma';

const appendBreadcrumbPoint = (existing: unknown, lng: number, lat: number) => {
  const current = Array.isArray(existing) ? [...existing] : [];
  current.push([lng, lat, Date.now()]);
  return current.slice(-500);
};

export class ResponderService {
  async updateOwnStatus(userId: number, status: ResponderStatus) {
    const responder = await prisma.responder.findFirst({
      where: { userId, isActive: true, deletedAt: null },
      include: {
        assignedIncidents: {
          where: {
            status: {
              in: ['ASSIGNED', 'RESPONDING', 'ARRIVED'],
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!responder) {
      throw new Error('Responder profile not found');
    }

    const activeIncident = responder.assignedIncidents[0];
    const pinToIncident =
      status === ResponderStatus.ON_SCENE &&
      activeIncident?.latitude != null &&
      activeIncident?.longitude != null;

    const incidentLatitude = activeIncident?.latitude ?? null;
    const incidentLongitude = activeIncident?.longitude ?? null;
    const latitude = pinToIncident ? incidentLatitude : responder.latitude;
    const longitude = pinToIncident ? incidentLongitude : responder.longitude;

    const updated = await prisma.responder.update({
      where: { id: responder.id },
      data: {
        status,
        lastSeenAt: new Date(),
        ...(pinToIncident
          ? {
              latitude,
              longitude,
              breadcrumbs: appendBreadcrumbPoint(
                responder.breadcrumbs,
                incidentLongitude as number,
                incidentLatitude as number,
              ),
            }
          : {}),
      },
    });

    return updated;
  }
}

export const responderService = new ResponderService();
