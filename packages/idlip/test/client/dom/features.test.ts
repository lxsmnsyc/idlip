import {
  copyFileSync,
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
import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { getFeatures } from '../../../src/vite/features.ts';
import { createConfig } from '../../vite/app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../../..');
const FIXTURES = path.join(PACKAGE, 'test/fixtures');
const LOADER = path.join(PACKAGE, 'src/client/index.ts');
/** Text that only the Dom calls after the patch hold. */
const REFS_CODE = 'idlip: no ref';

/** Builds one fixture source with the real compiler and loader. Returns the loader files. */
async function buildLoader(name: string): Promise<string[]> {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-refs-')));
  try {
    mkdirSync(path.join(root, 'src'));
    const folder = path.join(FIXTURES, name);
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.tsx')) {
        copyFileSync(path.join(folder, file), path.join(root, 'src', file));
      }
    }
    writeFileSync(
      path.join(root, 'src/entry-server.js'),
      'export function render() { return ""; }\n',
    );
    const config = createConfig(root, { compile, client: LOADER });
    config.resolve = {};
    // Minified, as an app ships it, so the sizes are the loader's.
    config.build = { ...config.build, minify: true };
    const builder = await createBuilder(config);
    await builder.buildApp();
    const assets = path.join(root, 'dist/client/assets');
    const files: string[] = [];
    for (const file of readdirSync(assets)) {
      if (/^(?!.*\.(handler|binding|list|task)\.)/.test(file)) {
        files.push(readFileSync(path.join(assets, file), 'utf8'));
      }
    }
    return files;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function getGzipSize(files: readonly string[]): number {
  let total = 0;
  for (const code of files) {
    total += gzipSync(code, { level: 9 }).length;
  }
  return total;
}

describe('HAS_REFS', () => {
  it('is on when a handler calls Dom after the patch', () => {
    const source = readFileSync(path.join(FIXTURES, 'refs/refs.idlip.tsx'), 'utf8');
    expect([...getFeatures([compile(source, '/src/refs.idlip.tsx')])]).toContain('REFS');
    const todo = readFileSync(path.join(FIXTURES, 'todo/todo.idlip.tsx'), 'utf8');
    expect([...getFeatures([compile(todo, '/src/todo.idlip.tsx')])]).not.toContain('REFS');
  });

  it('keeps the Dom runner out of a loader that does not use it', async () => {
    const without = await buildLoader('todo');
    const withRefs = await buildLoader('refs');
    expect(without.join('')).not.toContain(REFS_CODE);
    expect(withRefs.join('')).toContain(REFS_CODE);
    expect(getGzipSize(withRefs)).toBeGreaterThan(getGzipSize(without));
  }, 60_000);
});
