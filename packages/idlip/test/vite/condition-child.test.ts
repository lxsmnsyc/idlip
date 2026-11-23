import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { readChunkUrls } from './app.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

const COUNTER = `import type { JSX } from 'idlip/jsx-runtime';
export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;
  function increment() { count = count + 1; }
  return <button on:click={increment}>{count}</button>;
}
`;

const BOARD = `import type { JSX } from 'idlip/jsx-runtime';
import Counter from './counter.tsx';
export default function Board(): JSX.Element {
  let open = false;
  function show() { open = !open; }
  return <main><button on:click={show}>Show</button>{open ? <Counter start={1} /> : null}</main>;
}
`;

const ENTRY = `import Board from './board.tsx';
export function render() { return String(Board); }
`;

function createApp(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-condition-')));
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), source);
  }
  return root;
}

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
    plugins: [idlip({ entry: '/src/entry-server.ts', client: CLIENT, compile })],
  });
  await builder.buildApp();
}

describe('a child inside a condition', () => {
  let root = '';

  beforeAll(async () => {
    root = createApp({
      'src/board.tsx': BOARD,
      'src/counter.tsx': COUNTER,
      'src/entry-server.ts': ENTRY,
    });
    await build(root);
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('builds, and the branch chunk imports the child view chunk', () => {
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const branch = urls['/src/board.tsx?idlip-binding=open&lang.js'];
    expect(urls['/src/counter.tsx?idlip-view&lang.js']).toMatch(/^\/assets\/counter\.view/);
    // The branch renders the child, so it imports the module of the child's view, as a list
    // chunk does. The loader fetches it with the branch chunk.
    const code = readFileSync(path.join(root, 'dist/client', branch), 'utf8');
    expect(code).toMatch(/from"\.\/counter[^"]*view[^"]*\.js"/);
    expect(code).toContain('/src/counter.tsx');
  });
});
