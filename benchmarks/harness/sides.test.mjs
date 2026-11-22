// Run with `pnpm -C benchmarks/harness test`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSide } from './sides.mjs';

test('a side splits on the first = only', () => {
  assert.deepEqual(parseSide('base=/tmp/a=b/dist'), {
    name: 'base',
    path: '/tmp/a=b/dist',
    preload: true,
  });
});

test('a side ending in :off serves the build without preload links', () => {
  assert.deepEqual(parseSide('off=/tmp/dist:off'), {
    name: 'off',
    path: '/tmp/dist',
    preload: false,
  });
});

test('a side without a name or a path fails', () => {
  assert.throws(() => parseSide('/tmp/dist'));
  assert.throws(() => parseSide('=/tmp/dist'));
  assert.throws(() => parseSide('base='));
});
