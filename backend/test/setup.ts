import path from 'path';
import http from 'http';
import dotenv from 'dotenv';
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

const envPath = path.resolve(process.cwd(), '.env.test');
dotenv.config({ path: envPath });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AI_ENDPOINT = process.env.AI_ENDPOINT || 'http://localhost:9999/classify';

// Mock Redis
vi.mock('ioredis', () => {
  const Redis = vi.fn();
  Redis.prototype.on = vi.fn();
  Redis.prototype.hset = vi.fn();
  Redis.prototype.hgetall = vi.fn().mockResolvedValue({});
  Redis.prototype.disconnect = vi.fn();
  Redis.prototype.flushall = vi.fn();
  return { default: Redis };
});

// Mock BullMQ
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      add: vi.fn(),
      close: vi.fn(),
    })),
    Worker: vi.fn(),
  };
});

let resetDatabase: (() => Promise<void>) | null = null;
let prisma: { $disconnect: () => Promise<void> } | null = null;

beforeAll(async () => {
  if (!resetDatabase || !prisma) {
    const db = await import('./utils/db');
    const prismaModule = await import('../src/prisma');
    resetDatabase = db.resetDatabase;
    prisma = prismaModule.default;
  }
  if (!(globalThis as { __socketInit?: boolean }).__socketInit) {
    const { default: app } = await import('../src/app');
    const { initSocketServer } = await import('../src/socket');
    const server = http.createServer(app);
    initSocketServer(server);
    (globalThis as { __socketInit?: boolean }).__socketInit = true;
  }
});

beforeEach(async () => {
  if (resetDatabase) {
    await resetDatabase();
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
