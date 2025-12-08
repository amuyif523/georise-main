import prisma from "../../prisma";
import { getIO } from "../../socket";
import { ResponderStatus } from "@prisma/client";

export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
};

export async function handleETAAndGeofence(responderId: number) {
  const responder = await prisma.responder.findUnique({
    where: { id: responderId },
    select: { id: true, agencyId: true, latitude: true, longitude: true, incidentId: true, status: true },
  });
  if (!responder || responder.incidentId == null || responder.latitude == null || responder.longitude == null) return;

  const incident = await prisma.incident.findUnique({
    where: { id: responder.incidentId },
    select: { id: true, latitude: true, longitude: true, arrivalAt: true, status: true },
  });
  if (!incident || incident.latitude == null || incident.longitude == null) return;

  const distanceMeters = haversine(responder.latitude, responder.longitude, incident.latitude, incident.longitude);
  // simple ETA assumption
  const avgSpeedMPerMin = 1000; // ~60km/h
  const etaMinutes = distanceMeters / avgSpeedMPerMin;

  const io = getIO();
  io.to(`agency:${responder.agencyId}`).emit("responder:eta", {
    incidentId: incident.id,
    responderId: responder.id,
    distanceMeters,
    etaMinutes,
  });
  io.to(`responder:${responder.id}`).emit("responder:eta", {
    incidentId: incident.id,
    distanceMeters,
    etaMinutes,
  });

  if (distanceMeters <= 50 && !incident.arrivalAt) {
    const now = new Date();
    const updatedIncident = await prisma.incident.update({
      where: { id: incident.id },
      data: { status: "RESPONDING", arrivalAt: now },
    });
    await prisma.responder.update({
      where: { id: responder.id },
      data: { status: ResponderStatus.ON_SCENE },
    });
    await prisma.activityLog.create({
      data: {
        incidentId: incident.id,
        type: "STATUS_CHANGE",
        message: "Responder arrived on scene (auto-detected)",
      },
    });
    io.emit("incident:arrival", {
      incidentId: incident.id,
      responderId: responder.id,
      arrivalAt: updatedIncident.arrivalAt,
    });
  }
}
