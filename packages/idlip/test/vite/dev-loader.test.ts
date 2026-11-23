import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

describe('the dev loader', () => {
  it('serves /@id/idlip/client as a proxy of the URL that chunks import', async () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-dev-loader-')));
    mkdirSync(path.join(root, 'src'));
    // Stands for a chunk that imports from the loader.
    writeFileSync(
      path.join(root, 'src/chunk.js'),
      "import 'idlip/client';\nimport { setAttr$ } from 'idlip/helpers';\nexport { setAttr$ };\n",
    );
    const vite = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      cacheDir: path.join(root, '.vite-dev'),
      resolve: { alias: { 'idlip/client': CLIENT } },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      plugins: [idlip({ compile })],
    });
    const http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => {
      http.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = http.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      const response = await fetch(`http://127.0.0.1:${port}/@id/idlip/client`);
      const code = await response.text();
      // One import, of the URL a chunk's `import 'idlip/client'` gets, and no loader code.
      const chunk = await vite.environments.client.transformRequest('/src/chunk.js');
      const imported = /^import ["']([^"']+)["']/m.exec(code)?.[1];
      expect(imported).toMatch(/src\/client\/index\.ts$/);
      expect(chunk?.code).toContain(`import "${imported}"`);
      expect(code).not.toContain('resume(');
      // The helpers module imports the loader from the same URL, so its DOM code and block hooks
      // are the page's. In dev it loads after the chunk that imports it: one round trip is
      // build-only.
      const helpersUrl = /from ["']([^"']*idlip-helpers[^"']*)["']/.exec(chunk?.code ?? '')?.[1];
      expect(helpersUrl).toBeDefined();
      const helpers = await fetch(`http://127.0.0.1:${port}${helpersUrl ?? ''}`);
      const helpersCode = await helpers.text();
      expect(helpersCode).toMatch(/function setAttr\$\(/);
      expect(/^import \{[^}]*\} from ["']([^"']+)["']/m.exec(helpersCode)?.[1]).toBe(imported);
    } finally {
      await new Promise((resolve) => {
        http.close(resolve);
      });
      await vite.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
