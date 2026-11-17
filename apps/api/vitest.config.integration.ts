import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/detection.integration-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
