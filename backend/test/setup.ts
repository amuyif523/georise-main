import path from "path";
import http from "http";
import dotenv from "dotenv";
import { beforeAll, afterAll, beforeEach } from "vitest";

const envPath = path.resolve(process.cwd(), ".env.test");
dotenv.config({ path: envPath });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.AI_ENDPOINT = process.env.AI_ENDPOINT || "http://localhost:9999/classify";

let resetDatabase: (() => Promise<void>) | null = null;
let prisma: { $disconnect: () => Promise<void> } | null = null;

beforeAll(async () => {
  if (!resetDatabase || !prisma) {
    const db = await import("./utils/db");
    const prismaModule = await import("../src/prisma");
    resetDatabase = db.resetDatabase;
    prisma = prismaModule.default;
  }
  if (!(globalThis as { __socketInit?: boolean }).__socketInit) {
    const { default: app } = await import("../src/app");
    const { initSocketServer } = await import("../src/socket");
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
