import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../redis";
import logger from "../logger";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis types mismatch with rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, "Rate limit exceeded");
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // Limit each IP to 10 login attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis types mismatch with rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  message: "Too many login attempts, please try again later.",
});
