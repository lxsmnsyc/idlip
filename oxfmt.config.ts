import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  ignorePatterns: ['packages/idlip/test/fixtures/**/expected/**'],
});
