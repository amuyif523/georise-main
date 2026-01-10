import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Prisma CLI');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: DATABASE_URL,
  },
});
