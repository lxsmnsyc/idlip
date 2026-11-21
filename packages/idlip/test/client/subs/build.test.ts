import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createBuilder } from 'vite';
import { expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { createConfig } from '../../vite/app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../../..');
const LOADER = path.join(PACKAGE, 'src/client/index.ts');

const APP = `
import { Subscribe, timer } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Clock(): JSX.Element {
  let ticks = 0;
  function tick(now: number) {
    ticks = ticks + 1;
  }
  return (
    <main>
      <p>{ticks}</p>
      <Subscribe to={timer} input={1000} on:value={tick} />
    </main>
  );
}
`;

function gzipSize(code: string): number {
  return gzipSync(code, { level: 9 }).length;
}

it('builds a source chunk that imports idlip without a shared chunk, and sizes the loader', async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-subs-')));
  try {
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src/clock.idlip.tsx'), APP);
    writeFileSync(
      path.join(root, 'src/entry-server.js'),
      'export function render() { return ""; }\n',
    );
    const config = createConfig(root, { compile, client: LOADER });
    config.resolve = { alias: { idlip: path.join(PACKAGE, 'src/index.ts') } };
    config.build = { minify: true };
    const builder = await createBuilder(config);
    await builder.buildApp();
    const assets = path.join(root, 'dist/client/assets');
    const files = readdirSync(assets);
    const sources = files.filter((file) => file.includes('.source.'));
    expect(sources).toHaveLength(1);
    // The source chunk holds its own copy of `timer`: it imports no other file.
    const source = readFileSync(path.join(assets, sources[0]), 'utf8');
    expect(source).not.toMatch(/from\s*["']\.\//);
    // Every other file is a loader, a binding or a handler.
    const loader = files.find((file) => !file.startsWith('clock.') && file !== 'build.js');
    expect(loader).toBeDefined();
    const size = gzipSize(readFileSync(path.join(assets, loader ?? ''), 'utf8'));
    // oxlint-disable-next-line no-console
    console.log(`loader with <Subscribe>: ${size} B gzip, source chunk ${gzipSize(source)} B gzip`);
    // The loader holds the subscription runtime, which the feature flag turned on.
    expect(readFileSync(path.join(assets, loader ?? ''), 'utf8')).toContain('i-sub');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
