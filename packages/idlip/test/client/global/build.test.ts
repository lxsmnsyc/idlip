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
import { createBuilder, createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { createCheckedCompile, createConfig } from '../../vite/app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../../..');
const LOADER = path.join(PACKAGE, 'src/client/index.ts');
/** Text that only the dev warning holds. */
const WARNING = 'events are waiting for one element';

/** Builds the todo fixture with the real loader, and returns the text of the client files. */
async function buildClient(nodeEnv: string): Promise<string> {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-dev-')));
  const previous = process.env.NODE_ENV;
  // Vite takes `NODE_ENV` from the process first, and the test runner sets it to `test`.
  process.env.NODE_ENV = nodeEnv;
  try {
    mkdirSync(path.join(root, 'src'));
    const folder = path.join(PACKAGE, 'test/fixtures/todo');
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        copyFileSync(path.join(folder, file), path.join(root, 'src', file));
      }
    }
    writeFileSync(
      path.join(root, 'src/entry-server.js'),
      'export function render() { return ""; }\n',
    );
    const { compile } = createCheckedCompile(root);
    const config = createConfig(root, { compile, client: LOADER });
    // The real loader, not the stub the fixture app aliases.
    config.resolve = {};
    const builder = await createBuilder(config);
    await builder.buildApp();
    const assets = path.join(root, 'dist/client/assets');
    let text = '';
    for (const file of readdirSync(assets)) {
      text += readFileSync(path.join(assets, file), 'utf8');
    }
    return text;
  } finally {
    process.env.NODE_ENV = previous;
    rmSync(root, { recursive: true, force: true });
  }
}

describe('dev warning in the Vite dev server', () => {
  it('serves dev.ts without a `process` global', async () => {
    const server = await createServer({
      configFile: false,
      root: PACKAGE,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const result = await server.transformRequest(path.join(PACKAGE, 'src/core/dev.ts'));
      // The runner sets `NODE_ENV=test`, which Vite writes in place of the name.
      expect(result?.code).toContain('!== "production"');
      expect(result?.code).toMatch(/export const DEV = "\w+" !== "production";/);
    } finally {
      await server.close();
    }
  });
});

describe('dev warning in the client build', () => {
  it('drops the warning from a production build', async () => {
    expect(await buildClient('production')).not.toContain(WARNING);
  }, 60_000);

  it('keeps the warning in a development build', async () => {
    expect(await buildClient('development')).toContain(WARNING);
  }, 60_000);
});
