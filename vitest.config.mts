import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 5000,
  },
});
