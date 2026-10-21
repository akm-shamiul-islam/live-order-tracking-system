import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['backend/src/**/*.integration.ts'],
    testTimeout: 20_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
