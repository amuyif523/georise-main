import { Request, Response } from "express";
import prisma from "../../prisma";
import redis from "../../redis";
import axios from "axios";

const AI_ENDPOINT = process.env.AI_ENDPOINT || "http://localhost:8001";

export const getSystemHealth = async (req: Request, res: Response) => {
  const health: any = {
    status: "ok",
    timestamp: new Date(),
    services: {
      database: { status: "unknown", latency: 0 },
      redis: { status: "unknown", latency: 0 },
      ai: { status: "unknown", latency: 0 },
    },
  };

  // Check Database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database.status = "up";
    health.services.database.latency = Date.now() - dbStart;
  } catch (err) {
    health.services.database.status = "down";
    health.status = "degraded";
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redis.ping();
    health.services.redis.status = "up";
    health.services.redis.latency = Date.now() - redisStart;
  } catch (err) {
    health.services.redis.status = "down";
    health.status = "degraded";
  }

  // Check AI Service
  const aiStart = Date.now();
  try {
    // Just check root or docs to verify connectivity
    await axios.get(`${AI_ENDPOINT}/docs`, { timeout: 2000 });
    health.services.ai.status = "up";
    health.services.ai.latency = Date.now() - aiStart;
  } catch (err) {
    health.services.ai.status = "down";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
};
