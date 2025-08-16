import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    root: './dist-test',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    include: ['test/**/*.test.js', 'tests/**/*.test.js', 'src/**/*.test.js'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './dist-test/src'),
      '@nelo/context': resolve(__dirname, '../../packages/context'),
      '@nelo/db': resolve(__dirname, '../../packages/db'),
    },
  },
});