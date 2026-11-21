import {
  existsSync,
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
import { createBuilder } from 'vite';
import { describe, expect, it } from 'vitest';
import type { Manifest, RenderContext } from '../../src/core/format.ts';
import { render } from '../../src/server/index.ts';
import { getDefines } from '../../src/vite/features.ts';
import { BUILDS_FILE, BUILD_KEY, getBuildId, keepBuilds, readBuilds } from '../../src/vite/skew.ts';
import { createApp, createConfig, readChunkUrls } from './app.ts';

function listLoaders(root: string): string[] {
  return readdirSync(path.join(root, 'dist/client/assets')).filter((file) =>
    file.startsWith('loader'),
  );
}

/** Builds the fixture app with a loader whose text is `body`, so each build has its own files. */
async function buildWith(root: string, body: string): Promise<void> {
  const loader = path.join(root, 'src/loader.js');
  writeFileSync(loader, `import 'idlip/client';\nglobalThis.build = ${JSON.stringify(body)};\n`);
  const builder = await createBuilder(createConfig(root, { client: loader }));
  await builder.buildApp();
}

describe('build ids', () => {
  it('depends on the file names only, not on their order', () => {
    expect(getBuildId(['a.js', 'b.js'])).toBe(getBuildId(['b.js', 'a.js']));
    expect(getBuildId(['a.js', 'b.js'])).not.toBe(getBuildId(['a.js', 'c.js']));
  });

  it('turns the loader flag off with the option', () => {
    expect(getDefines(new Set(), false).get('__IDLIP_HAS_SKEW__')).toBe('false');
    expect(getDefines(new Set()).get('__IDLIP_HAS_SKEW__')).toBe('true');
  });
});

describe('keepBuilds', () => {
  it('keeps the previous build whole and drops the older ones', () => {
    const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-skew-')));
    try {
      const record = path.join(dir, BUILDS_FILE);
      const client = path.join(dir, 'client');
      mkdirSync(client);
      for (const file of ['a.js', 'b.js', 'shared.js', 'c.js']) {
        writeFileSync(path.join(client, file), file);
      }
      keepBuilds(record, client, { id: '1', files: ['a.js', 'shared.js'] });
      keepBuilds(record, client, { id: '2', files: ['b.js', 'shared.js'] });
      expect(existsSync(path.join(client, 'a.js'))).toBe(true);
      keepBuilds(record, client, { id: '3', files: ['c.js'] });
      // Build 1 is gone, build 2 stays, and `shared.js` stays since build 2 holds it.
      expect(existsSync(path.join(client, 'a.js'))).toBe(false);
      expect(existsSync(path.join(client, 'b.js'))).toBe(true);
      expect(existsSync(path.join(client, 'shared.js'))).toBe(true);
      expect(readBuilds(record).map((item) => item.id)).toEqual(['2', '3']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the state script', () => {
  const manifest: Manifest = {
    module: '/src/a.idlip.tsx',
    events: [],
    listens: {},
    handlers: {},
    groups: {},
    lists: {},
  };

  async function renderWith(chunks: Record<string, string>): Promise<string> {
    function component(_props: unknown, context?: RenderContext): string {
      context?.state({ manifest, chunks, model: {}, props: {} });
      return '<p></p>';
    }
    return render(component, {});
  }

  it('carries the build id as i-build and not in the chunk map', async () => {
    const html = await renderWith({ [BUILD_KEY]: 'abc12345', '/x': '/assets/x.js' });
    expect(html).toContain('<script i-state i-build="abc12345">');
    expect(html.split('abc12345')).toHaveLength(2);
    expect(html).toContain('/assets/x.js');
  });

  it('has no attribute without a build id', async () => {
    expect(await renderWith({})).toContain('<script i-state>');
  });
});

describe('a client build', () => {
  it('records the build id, keeps the previous build and drops older ones', async () => {
    const root = createApp();
    try {
      await buildWith(root, 'one');
      const first = listLoaders(root);
      const chunks = path.join(root, 'dist/.idlip/chunks.json');
      const id = readChunkUrls(chunks)[BUILD_KEY];
      expect(id).toMatch(/^[\da-f]{8}$/);
      expect(first).toHaveLength(1);
      // The loader imports this module to read the build the server runs.
      expect(readFileSync(path.join(root, 'dist/client/assets/build.js'), 'utf8')).toContain(id);

      await buildWith(root, 'two');
      const second = listLoaders(root);
      expect(second).toHaveLength(2);
      expect(second).toContain(first[0]);

      await buildWith(root, 'three');
      const third = listLoaders(root);
      expect(third).toHaveLength(2);
      expect(third).not.toContain(first[0]);
      expect(readChunkUrls(chunks)[BUILD_KEY]).not.toBe(id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
