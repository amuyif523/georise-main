import cron from 'node-cron';
import prisma from '../prisma';
import logger from '../logger';
import { logActivity } from '../modules/incident/activity.service';

export const runSLAChecks = async () => {
  try {
    const thresholdMinutes = 10;
    const deadline = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    // Find incidents that are still pending and older than threshold
    const breachedIncidents = await prisma.incident.findMany({
      where: {
        status: { in: ['RECEIVED', 'UNDER_REVIEW'] },
        createdAt: { lt: deadline },
        // Optimization: Exclude if we already logged an escalation (this is a heuristic)
        // In a real app, we'd have a flag on the incident
      },
      include: {
        activityLogs: {
          where: { type: 'SYSTEM', message: { contains: 'SLA Breach' } },
        },
      },
    });

    for (const incident of breachedIncidents) {
      // If we haven't logged an SLA breach yet
      if (incident.activityLogs.length === 0) {
        logger.warn({ incidentId: incident.id }, 'SLA Breach detected');

        await logActivity(
          incident.id,
          'SYSTEM',
          `⚠️ SLA Breach: Incident pending for >${thresholdMinutes} mins. Escalating to Supervisor.`,
        );

        // Here we would also trigger a notification to admins/supervisors
        // await notificationService.notifyAdmins(...)
      }
    }

    // 2. Responder Acknowledgement SLA (90 seconds)
    const ackDeadline = new Date(Date.now() - 90 * 1000);
    const staleAssignments = await prisma.incident.findMany({
      where: {
        status: 'ASSIGNED',
        acknowledgedAt: null,
        dispatchedAt: { lt: ackDeadline },
      },
      include: { assignedResponder: true },
    });

    if (staleAssignments.length > 0) {
      // Dynamic import to avoid circular dependency issues if any, though socket.ts is low level
      const { getIO } = await import('../socket');
      const io = getIO();

      for (const incident of staleAssignments) {
        logger.warn({ incidentId: incident.id }, 'Assignment SLA Breach: Auto-declining');

        await prisma.$transaction(async (tx) => {
          // Reset Incident
          const updatedIncident = await tx.incident.update({
            where: { id: incident.id },
            data: {
              status: 'RECEIVED',
              assignedResponderId: null,
              dispatchedAt: null,
              // Keep agency assignment? If we strip responder, implementation plan said
              // "Re-queue incident". Re-queue usually means make available for anyone.
              // But let's act conservatively and keep agency if it was set,
              // but status RECEIVED makes it show up in dispatch queue again.
            },
          });

          // Reset Responder
          if (incident.assignedResponderId) {
            await tx.responder.update({
              where: { id: incident.assignedResponderId },
              data: { status: 'AVAILABLE' },
            });
          }

          // Log
          await tx.activityLog.create({
            data: {
              incidentId: incident.id,
              type: 'SYSTEM',
              message: '⚠️ Assignment Timeout: Responder did not acknowledge in 90s. Re-queued.',
            },
          });

          // Notify via Socket
          try {
            io.to(`incident:${incident.id}`).emit('incident:updated', updatedIncident);
            if (updatedIncident.assignedAgencyId) {
              io.to(`agency:${updatedIncident.assignedAgencyId}`).emit(
                'incident:updated',
                updatedIncident,
              );
            }
            // Alert Global/Admin
            io.to('role:ADMIN').emit('incident:updated', updatedIncident);
          } catch (socketErr) {
            logger.warn({ err: socketErr }, 'Socket emit failed during SLA check');
          }
        });
      }
    }
  } catch (err) {
    logger.error({ err }, 'SLA Job failed');
  }
};

export const initSLAJob = () => {
  // Run every minute
  cron.schedule('* * * * *', runSLAChecks);

  logger.info('SLA Background Job initialized');
};
