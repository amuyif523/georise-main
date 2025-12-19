import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from '../redis';
import logger from '../logger';
import { NODE_ENV } from '../config/env';

type LimiterOptions = {
  windowMs: number;
  limit: number;
  message: string;
  skipInDev?: boolean;
};

const buildStore = () => {
  if (NODE_ENV === 'test' || NODE_ENV === 'development') return undefined;
  return new RedisStore({
    // @ts-expect-error - ioredis types mismatch with rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(...args),
  });
};

const buildLimiter = ({ windowMs, limit, message, skipInDev }: LimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !!skipInDev && NODE_ENV === 'development',
    store: buildStore(),
    handler: (req, res) => {
      logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());
      res.status(429).json({
        message,
      });
    },
    message,
  });

// General API limiter (keep light in dev)
export const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: NODE_ENV === 'development' ? 1000 : 200,
  message: 'Too many requests, please try again later.',
  skipInDev: false,
});

// Strict login/OTP/password-reset limiter (protect credentials)
export const loginLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: NODE_ENV === 'development' ? 100 : 10,
  message: 'Too many login attempts, please try again later.',
  skipInDev: false,
});

// Session reads like /auth/me (more relaxed)
export const sessionLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  limit: NODE_ENV === 'development' ? 500 : 120,
  message: 'Too many session checks, please slow down.',
  skipInDev: false,
});
