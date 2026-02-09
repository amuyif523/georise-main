import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // No setupFiles to avoid DB connection
    include: ['test/audit.test.ts'],
    testTimeout: 10000,
  },
});
