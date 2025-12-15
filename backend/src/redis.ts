import Redis from "ioredis";
import { REDIS_URL } from "./config/env";
import logger from "./logger";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

export default redis;
