import config from '@lxsmnsyc/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [config],
  // Agent worktrees under .claude/ hold other branches' work in progress.
  // docs/ holds debate evidence and spike prototypes, which are not part of the package.
  ignorePatterns: [
    'packages/idlip/test/fixtures/**/expected/**',
    'dist/**',
    'packages/idlip/src/core/helpers-source.ts',
    'benchmarks/**',
    '.claude/**',
    'docs/**',
  ],
});
