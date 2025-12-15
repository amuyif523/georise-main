import prisma from "../../prisma";
import { getIO } from "../../socket";
import logger from "../../logger";

export class AlertService {
  async checkProximityAndAlert(incidentId: number) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident || !incident.latitude || !incident.longitude) return;
    
    // Requirement: incident = CONFIRMED & Severity > 4
    // We interpret CONFIRMED as reviewStatus = APPROVED
    if (incident.reviewStatus !== "APPROVED" || (incident.severityScore || 0) <= 4) {
        return;
    }

    // Find users within 2km (2000 meters)
    // We use the 'location' column on User which is a Geometry(Point, 4326)
    // ST_DWithin takes geometry, geometry, distance_in_degrees (if 4326) or meters (if cast to geography)
    
    try {
      const users = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "User"
        WHERE "location" IS NOT NULL
        AND ST_DWithin(
          "location"::geography,
          ST_SetSRID(ST_MakePoint(${incident.longitude}, ${incident.latitude}), 4326)::geography,
          2000
        )
        AND (${incident.reporterId} IS NULL OR id != ${incident.reporterId})
      `;

      if (users.length === 0) return;

      logger.info({ incidentId, userCount: users.length }, "Sending proximity alerts");

      const notifications = users.map(u => ({
        userId: u.id,
        title: "Danger Nearby",
        message: `High severity incident reported near you: ${incident.title}`,
        type: "PROXIMITY_ALERT",
        data: { incidentId: incident.id, lat: incident.latitude, lng: incident.longitude }
      }));

      // Batch insert notifications
      await prisma.notification.createMany({
        data: notifications
      });

      // Emit socket events
      const io = getIO();
      users.forEach(u => {
        io.to(`user:${u.id}`).emit("alert:proximity", {
          title: "Danger Nearby",
          message: `High severity incident reported near you: ${incident.title}`,
          incidentId: incident.id,
          lat: incident.latitude,
          lng: incident.longitude
        });
      });
    } catch (err) {
      logger.error({ err }, "Failed to process proximity alerts");
    }
  }
}

export const alertService = new AlertService();
