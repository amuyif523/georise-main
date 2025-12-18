import cron from 'node-cron';
import prisma from '../prisma';
import logger from '../logger';
import { logActivity } from '../modules/incident/activity.service';

export const initSLAJob = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
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
    } catch (err) {
      logger.error({ err }, 'SLA Job failed');
    }
  });

  logger.info('SLA Background Job initialized');
};
