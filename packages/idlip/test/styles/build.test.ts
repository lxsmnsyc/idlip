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
import { pathToFileURL } from 'node:url';
import { createBuilder } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

/** The files of the app: a document with a plain stylesheet and a CSS Module, and a child. */
const FILES: Record<string, string> = {
  'src/app.tsx': `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import './app.css';
import styles from './app.module.css';
import Panel from './panel.tsx';

export default function App(): JSX.Element {
  let open = false;

  function toggle() {
    open = !open;
  }

  return (
    <html lang="en">
      <head>
        <title>styles</title>
      </head>
      <body>
        <button class={open ? styles.on : styles.off} on:click={toggle}>toggle</button>
        {open && <Panel />}
      </body>
    </html>
  );
}
`,
  'src/panel.tsx': `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import './panel.css';
import panelStyles from './panel.module.css';

export default function Panel(): JSX.Element {
  let count = 0;

  function add() {
    count = count + 1;
  }

  return <button class={count > 1 ? panelStyles.big : "panel"} on:click={add}>{count}</button>;
}
`,
  'src/panel.module.css': '.big { color: rgb(2, 4, 6); }\n',
  'src/app.css': 'body { color: rgb(1, 2, 3); }\n',
  'src/panel.css': '.panel { color: rgb(4, 5, 6); }\n',
  'src/app.module.css': '.on { color: rgb(7, 8, 9); }\n.off { color: rgb(9, 8, 7); }\n',
  'src/entry-server.js': `import { renderToResponse } from 'idlip/server';
import App from './app.tsx';

export default {
  fetch() {
    return renderToResponse(App, {}, { csp: true });
  },
};
`,
};

function createApp(): string {
  // The real path, since Vite names modules by it.
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-styles-')));
  for (const [file, source] of Object.entries(FILES)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
  return root;
}

function readAll(dir: string, extension: string): string {
  let out = '';
  for (const name of readdirSync(dir)) {
    if (name.endsWith(extension)) {
      out += `${readFileSync(path.join(dir, name), 'utf8')}\n`;
    }
  }
  return out;
}

describe('component styles in a build', () => {
  let root = '';
  let html = '';

  beforeAll(async () => {
    root = createApp();
    const builder = await createBuilder({
      configFile: false,
      root,
      logLevel: 'silent',
      cacheDir: path.join(root, '.vite'),
      plugins: [idlip({ entry: '/src/entry-server.js', client: CLIENT })],
      resolve: {
        alias: {
          'idlip/client': CLIENT,
          'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
        },
      },
      ssr: { noExternal: true },
      build: { minify: false },
    });
    await builder.buildApp();
    const entry = path.join(root, 'dist/server/entry-server.mjs');
    const server: unknown = await import(pathToFileURL(entry).href);
    const handler: unknown = Reflect.get(Object(server), 'default');
    const fetchPage: unknown = Reflect.get(Object(handler), 'fetch');
    if (typeof fetchPage !== 'function') {
      throw new TypeError('The server entry has no fetch');
    }
    const answer: unknown = await Reflect.apply(fetchPage, handler, []);
    if (!(answer instanceof Response)) {
      throw new TypeError('fetch returned no Response');
    }
    const response = answer;
    html = await response.text();
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the stylesheets of the import graph as client assets', () => {
    const text = readAll(path.join(root, 'dist/client/assets'), '.css');
    expect(text).toContain('rgb(1, 2, 3)');
    expect(text).toContain('rgb(4, 5, 6)');
    expect(text).toContain('rgb(7, 8, 9)');
  });

  it('links a stylesheet that only a child imports, which renders after a click', () => {
    // The first render has no panel, so the page links its stylesheet from the build data.
    expect(html).not.toContain('class="panel"');
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toHaveLength(2);
    let linked = '';
    for (const link of links) {
      linked += readFileSync(path.join(root, 'dist/client', link), 'utf8');
    }
    expect(linked).toContain('rgb(4, 5, 6)');
    expect(linked).toContain('rgb(1, 2, 3)');
    expect(linked).toContain('rgb(7, 8, 9)');
  });

  it('puts the links in the head, before the preload links, with the nonce', () => {
    const nonce = /<script nonce="([^"]+)"/.exec(html)?.[1];
    expect(nonce).toBeDefined();
    const link = html.indexOf('<link rel="stylesheet"');
    expect(html.slice(link, html.indexOf('>', link))).toContain(`nonce="${nonce}"`);
    expect(link).toBeLessThan(html.indexOf('</head>'));
    const preload = html.indexOf('<link rel="modulepreload"');
    if (preload >= 0) {
      expect(link).toBeLessThan(preload);
    }
  });

  it('keeps the stylesheet links out of the state script', () => {
    expect(html.match(/\.css/g)).toHaveLength(2);
  });

  it('gives the server render and the chunks the same CSS Module class names', () => {
    const sheet = readAll(path.join(root, 'dist/client/assets'), '.css');
    const off = /\.(_off_\w+)/.exec(sheet)?.[1] ?? '';
    const on = /\.(_on_\w+)/.exec(sheet)?.[1] ?? '';
    expect(html).toContain(`<button class="${off}"`);
    // The client chunk that sets the class holds both names.
    const chunks = readAll(path.join(root, 'dist/client/assets'), '.js');
    expect(chunks).toContain(off);
    expect(chunks).toContain(on);
  });

  it('writes the view of a child that reads a CSS Module as one file, with no stub', () => {
    const files = readdirSync(path.join(root, 'dist/client/assets'));
    const views = files.filter((name) => /^panel\.view[.-]/.test(name));
    expect(views).toHaveLength(1);
    const code = readFileSync(path.join(root, 'dist/client/assets', views[0]), 'utf8');
    // The view holds its template and the class names, and re-exports nothing from another file.
    expect(code).toContain('<button');
    expect(code).toContain('big');
    expect(code).not.toMatch(/export\s*\{[^}]*\}\s*from/);
  });

  it('leaves no entry for the stylesheets and no shared chunk for the class names', () => {
    const files = readdirSync(path.join(root, 'dist/client/assets'));
    expect(files.some((name) => name.includes('module'))).toBe(false);
    expect(files.some((name) => name.includes('styles'))).toBe(false);
  });
});
