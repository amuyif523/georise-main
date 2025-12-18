import cron from 'node-cron';
import prisma from '../prisma';
import { getIO } from '../socket';
import logger from '../logger';

type RoutePoint = { lat: number; lng: number };

// Simple demo routes in Addis (approximate)
const demoRoutes: RoutePoint[][] = [
  [
    { lat: 9.01, lng: 38.74 },
    { lat: 9.012, lng: 38.741 },
    { lat: 9.015, lng: 38.742 },
    { lat: 9.017, lng: 38.744 },
    { lat: 9.015, lng: 38.746 },
    { lat: 9.012, lng: 38.745 },
  ],
  [
    { lat: 8.995, lng: 38.77 },
    { lat: 8.997, lng: 38.772 },
    { lat: 9.0, lng: 38.774 },
    { lat: 9.003, lng: 38.775 },
    { lat: 9.002, lng: 38.772 },
    { lat: 8.998, lng: 38.771 },
  ],
  [
    { lat: 9.025, lng: 38.745 },
    { lat: 9.027, lng: 38.747 },
    { lat: 9.03, lng: 38.748 },
    { lat: 9.032, lng: 38.746 },
    { lat: 9.03, lng: 38.744 },
    { lat: 9.027, lng: 38.743 },
  ],
];

const progress = new Map<number, { routeIdx: number; pointIdx: number }>();
let job: cron.ScheduledTask | null = null;

const stepResponders = async () => {
  try {
    const responders = await prisma.responder.findMany({
      where: { isDemo: true },
      select: { id: true, agencyId: true, status: true },
    });
    if (!responders.length) return;

    const updates = responders.map(async (resp) => {
      const state = progress.get(resp.id) || {
        routeIdx: resp.id % demoRoutes.length,
        pointIdx: 0,
      };
      const route = demoRoutes[state.routeIdx];
      const point = route[state.pointIdx % route.length];

      const next = {
        routeIdx: state.routeIdx,
        pointIdx: (state.pointIdx + 1) % route.length,
      };
      progress.set(resp.id, next);

      await prisma.responder.update({
        where: { id: resp.id },
        data: {
          latitude: point.lat,
          longitude: point.lng,
          lastSeenAt: new Date(),
        },
      });

      if (resp.agencyId) {
        getIO().to(`agency:${resp.agencyId}`).emit('responder:position', {
          responderId: resp.id,
          lat: point.lat,
          lng: point.lng,
          status: resp.status,
        });
      }
    });

    await Promise.all(updates);
  } catch (err) {
    logger.error({ err }, 'Responder simulation tick failed');
  }
};

export const startResponderSimulation = () => {
  if (job) return { running: true, message: 'Simulation already running' };
  job = cron.schedule('*/10 * * * * *', stepResponders);
  logger.info('Responder simulation started (10s interval)');
  return { running: true };
};

export const stopResponderSimulation = () => {
  if (job) {
    job.stop();
    job = null;
    progress.clear();
    logger.info('Responder simulation stopped');
  }
  return { running: false };
};

export const responderSimulationStatus = () => ({
  running: !!job,
  intervalSeconds: 10,
});
