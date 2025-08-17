import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://nelo:nelo@localhost:5432/nelo_test',
      TEST_DATABASE_URL: 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Run tests sequentially to avoid database conflicts
    // Note: vitest 0.34.6 doesn't support pool options, using threads instead
    threads: false,
    // Increase timeout for database operations
    testTimeout: 10000,
  },
});