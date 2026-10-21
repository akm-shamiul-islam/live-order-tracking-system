import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Source tests must not depend on an existing or possibly stale build.
    alias: {
      '@kitchentodoor/shared/zod': fileURLToPath(new URL('./shared/src/zod.ts', import.meta.url)),
      '@kitchentodoor/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // Run maintained source tests once; ignore emitted tests in dist and old backups.
    include: [
      'backend/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'frontend/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'shared/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
  },
});
