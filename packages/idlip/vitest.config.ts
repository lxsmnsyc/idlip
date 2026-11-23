import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Golden chunks import their helpers as a build serves them. The sources stand in.
    alias: {
      'idlip/helpers': fileURLToPath(new URL('src/core/helpers.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
