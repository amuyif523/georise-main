import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { metrics } from './metrics/metrics.service';
import logger from './logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const basePrisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = process.hrtime.bigint();
        let success = true;
        try {
          return await query(args);
        } catch (err) {
          success = false;
          throw err;
        } finally {
          const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          metrics.logDbQuery({
            model: model ?? 'Unknown',
            action: operation,
            durationMs: Number(durationMs.toFixed(2)),
            success,
          });
        }
      },
    },
    async $queryRaw({ args, query }) {
      const start = process.hrtime.bigint();
      let success = true;
      try {
        return await query(args);
      } catch (err) {
        success = false;
        throw err;
      } finally {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        metrics.logDbQuery({
          model: 'raw',
          action: 'queryRaw',
          durationMs: Number(durationMs.toFixed(2)),
          success,
        });
        if (durationMs > 1000) {
          logger.warn({ durationMs, action: 'queryRaw' }, 'Slow raw query detected');
        }
      }
    },
    async $executeRaw({ args, query }) {
      const start = process.hrtime.bigint();
      let success = true;
      try {
        return await query(args);
      } catch (err) {
        success = false;
        throw err;
      } finally {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        metrics.logDbQuery({
          model: 'raw',
          action: 'executeRaw',
          durationMs: Number(durationMs.toFixed(2)),
          success,
        });
      }
    },
  },
});

export default prisma;
