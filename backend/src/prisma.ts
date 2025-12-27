import { PrismaClient } from '@prisma/client';
import { metrics } from './metrics/metrics.service';
import logger from './logger';

const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  const start = process.hrtime.bigint();
  let success = true;
  try {
    const result = await next(params);
    return result;
  } catch (err) {
    success = false;
    throw err;
  } finally {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    metrics.logDbQuery({
      model: params.model ?? 'raw',
      action: params.action,
      durationMs: Number(durationMs.toFixed(2)),
      success,
    });

    if (params.action === 'queryRaw' && durationMs > 1000) {
      logger.warn(
        { durationMs, action: params.action },
        'Slow raw query detected (consider optimizing)',
      );
    }
  }
});

export default prisma;
