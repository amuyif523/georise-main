import cron from 'node-cron';
import prisma from '../prisma';
import logger from '../logger';

export const runHeartbeatCheck = async () => {
  try {
    const deadline = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const silentResponders = await prisma.responder.findMany({
      where: {
        status: { not: 'OFFLINE' },
        lastSeenAt: { lt: deadline },
      },
    });

    if (silentResponders.length > 0) {
      // Dynamic import to avoid circular dependency issues if any
      const { getIO } = await import('../socket');
      const io = getIO();

      for (const responder of silentResponders) {
        logger.info(
          { responderId: responder.id, lastSeenAt: responder.lastSeenAt },
          'Responder heartbeat timeout - setting OFFLINE',
        );

        await prisma.responder.update({
          where: { id: responder.id },
          data: {
            status: 'OFFLINE',
            incidentId: null,
          },
        });

        if (responder.agencyId) {
          io.to(`agency:${responder.agencyId}`).emit('responder:statusUpdate', {
            responderId: responder.id,
            status: 'OFFLINE',
            lastSeenAt: responder.lastSeenAt,
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Heartbeat Job failed');
  }
};

export const initHeartbeatJob = () => {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', runHeartbeatCheck);
  logger.info('Heartbeat Background Job initialized');
};
