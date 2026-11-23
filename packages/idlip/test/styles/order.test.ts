import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBuilder } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

// The root imports a sheet, a helper that imports a sheet and a cycle back to itself, a child
// with two sheets, and the child's first sheet again. Import order, first occurrence first:
// a, helper, cycle, shared, panel.
const FILES: Record<string, string> = {
  'src/app.tsx': `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import './a.css';
import './helper.ts';
import Panel from './panel.tsx';
import './shared.css';

export default function App(): JSX.Element {
  let open = false;

  function toggle() {
    open = !open;
  }

  return (
    <html lang="en">
      <head>
        <title>order</title>
      </head>
      <body>
        <button on:click={toggle}>toggle</button>
        {open && <Panel />}
      </body>
    </html>
  );
}
`,
  'src/panel.tsx': `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import './shared.css';
import './panel.css';

export default function Panel(): JSX.Element {
  let count = 0;

  function add() {
    count = count + 1;
  }

  return <button class="panel" on:click={add}>{count}</button>;
}
`,
  'src/helper.ts': "import './helper.css';\nimport './cycle.ts';\nexport const x = 1;\n",
  'src/cycle.ts': "import './cycle.css';\nimport { x } from './helper.ts';\nexport const y = x;\n",
  'src/a.css': '.a-mark { color: rgb(1, 0, 0); }\n',
  'src/helper.css': '.helper-mark { color: rgb(2, 0, 0); }\n',
  'src/cycle.css': '.cycle-mark { color: rgb(3, 0, 0); }\n',
  'src/shared.css': '.shared-mark { color: rgb(4, 0, 0); }\n',
  'src/panel.css': '.panel-mark { color: rgb(5, 0, 0); }\n',
  'src/entry-server.js': `import { renderToResponse } from 'idlip/server';
import App from './app.tsx';

export default {
  fetch() {
    return renderToResponse(App, {});
  },
};
`,
};

describe('the order of the stylesheet links', () => {
  let root = '';
  let html = '';

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-order-')));
    for (const [file, source] of Object.entries(FILES)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), source);
    }
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
    const entry = pathToFileURL(path.join(root, 'dist/server/entry-server.mjs')).href;
    const server: unknown = await import(entry);
    const handler: unknown = Reflect.get(Object(server), 'default');
    const fetchPage: unknown = Reflect.get(Object(handler), 'fetch');
    if (typeof fetchPage !== 'function') {
      throw new TypeError('The server entry has no fetch');
    }
    const answer: unknown = await Reflect.apply(fetchPage, handler, []);
    if (!(answer instanceof Response)) {
      throw new TypeError('fetch returned no Response');
    }
    html = await answer.text();
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('links the stylesheets in import order, through a helper and a cycle', () => {
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    let text = '';
    for (const link of links) {
      text += readFileSync(path.join(root, 'dist/client', link), 'utf8');
    }
    const marks = ['a', 'helper', 'cycle', 'shared', 'panel'].map((name) =>
      text.indexOf(`.${name}-mark`),
    );
    expect(marks.every((mark) => mark >= 0)).toBe(true);
    expect(marks).toEqual(marks.toSorted((a, b) => a - b));
  });

  it('links a stylesheet that two components import once', () => {
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(links).size).toBe(links.length);
    let text = '';
    for (const link of links) {
      text += readFileSync(path.join(root, 'dist/client', link), 'utf8');
    }
    expect(text.match(/\.shared-mark/g)).toHaveLength(1);
  });
});
