import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  ignorePatterns: [
    'packages/idlip/test/fixtures/**/expected/**',
    'packages/idlip/src/core/helpers-source.ts',
  ],
});
