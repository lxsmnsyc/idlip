import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readChunkUrls } from './app.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

/** A component with one list whose rows are `<li class="<row>">`. */
function createComponent(name: string, row: string, long = true): string {
  const title = long
    ? ` title="${'A row of the list, long enough to be worth sharing. '.repeat(2)}"`
    : '';
  return `// oxlint-disable typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function ${name}(): JSX.Element {
  let items = [{ id: 'a', label: 'One' }];

  function add() {
    items = [...items, { id: 'b', label: 'Two' }];
  }

  return (
    <div>
      <button on:click={add}>Add</button>
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => <li class="${row}"${title}><b>{item.label}</b></li>}
        </For>
      </ul>
    </div>
  );
}
`;
}

const OUTER = `import type { JSX } from 'idlip/jsx-runtime';
import Inner from './inner.tsx';

export default function Outer(): JSX.Element {
  return (
    <main>
      <Inner />
    </main>
  );
}
`;

const ENTRY = `import { render as renderHtml } from 'idlip/server';
import First from './first.tsx';
import Second from './second.tsx';
import Third from './third.tsx';
import Fourth from './fourth.tsx';
import Fifth from './fifth.tsx';
import Outer from './outer.tsx';
export async function render(): Promise<string> {
  const pages = [
    await renderHtml(First, {}),
    await renderHtml(Second, {}),
    await renderHtml(Third, {}),
    await renderHtml(Fourth, {}),
    await renderHtml(Fifth, {}),
    await renderHtml(Outer, {}),
  ];
  return pages.join('');
}
`;

async function build(root: string): Promise<void> {
  const builder = await createBuilder({
    configFile: false,
    root,
    logLevel: 'silent',
    cacheDir: path.join(root, '.vite'),
    resolve: {
      alias: {
        'idlip/client': CLIENT,
        'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
      },
    },
    ssr: { noExternal: true },
    build: { minify: false },
    plugins: [idlip({ entry: '/src/entry-server.ts', client: CLIENT })],
  });
  await builder.buildApp();
}

/** Counts the client files whose code holds the text. */
function countFiles(root: string, text: string): number {
  let found = 0;
  for (const name of globSync('dist/client/**/*.js', { cwd: root })) {
    if (readFileSync(path.join(root, name), 'utf8').includes(text)) {
      found += 1;
    }
  }
  return found;
}

describe('templates of the same markup in two components', () => {
  let root = '';

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-templates-')));
    const files: Record<string, string> = {
      'src/first.tsx': createComponent('First', 'row'),
      'src/second.tsx': createComponent('Second', 'row'),
      'src/third.tsx': createComponent('Third', 'solo'),
      'src/fourth.tsx': createComponent('Fourth', 'tiny', false),
      'src/fifth.tsx': createComponent('Fifth', 'tiny', false),
      'src/inner.tsx': createComponent('Inner', 'inner'),
      'src/outer.tsx': OUTER,
      'src/entry-server.ts': ENTRY,
    };
    for (const [name, source] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), source);
    }
    await build(root);
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('ships the markup in one file', () => {
    // Both lists clone the same row, which the shared templates module holds once.
    expect(countFiles(root, '<li class=\\"row\\"')).toBe(1);
  });

  it('keeps the markup of one chunk in that chunk', () => {
    expect(countFiles(root, '<li class=\\"solo\\"')).toBe(1);
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const templates = readFileSync(path.join(root, 'dist/client', urls.templates), 'utf8');
    expect(templates).toContain('row');
    expect(templates).not.toContain('solo');
  });

  it('keeps the rows of one file in that file when its view and list chunks both render them', () => {
    // A child's view chunk and its list chunk render the same row, in one file.
    expect(countFiles(root, '<li class=\\"inner\\"')).toBeGreaterThanOrEqual(2);
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const templates = readFileSync(path.join(root, 'dist/client', urls.templates), 'utf8');
    expect(templates).not.toContain('inner');
  });

  it('keeps a template inline when sharing costs more than the copies', () => {
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const templates = readFileSync(path.join(root, 'dist/client', urls.templates), 'utf8');
    expect(templates).not.toContain('tiny');
    expect(countFiles(root, '<li class=\\"tiny\\"')).toBe(2);
  });

  it('names the templates file in the chunk map, next to the helpers file', () => {
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    expect(urls.templates).toMatch(/^\/assets\/_idlip-templates[.-]/);
    expect(urls.helpers).toMatch(/^\/assets\/_idlip-helpers[.-]/);
  });
});
