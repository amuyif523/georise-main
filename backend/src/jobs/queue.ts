import { Queue } from 'bullmq';
import { REDIS_URL } from '../config/env';
import logger from '../logger';

const connection = {
  url: REDIS_URL,
};

export const incidentQueue = new Queue('incident-ai', {
  connection: {
    url: REDIS_URL,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

incidentQueue.on('error', (err) => {
  logger.error({ err }, 'Incident Queue error');
});

logger.info('Incident AI Queue initialized');
