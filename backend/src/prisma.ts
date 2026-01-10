import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { metrics } from './metrics/metrics.service';
import logger from './logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

// @ts-expect-error - $use is deprecated in Prisma 6+ but used here for legacy metrics
(prisma as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
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
