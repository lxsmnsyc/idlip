import { globSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder } from 'vite';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

function createApp(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-plain-')));
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
      alias: { 'idlip/client': CLIENT, 'idlip/server': path.join(PACKAGE, 'src/server/index.ts') },
    },
    plugins: [idlip({ entry: '/src/entry-server.ts', client: CLIENT, compile })],
  });
  await builder.buildApp();
}

const COUNTER = `import type { JSX } from 'idlip/jsx-runtime';
export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;
  function inc() { count += 1; }
  return <button on:click={inc}>{count}</button>;
}
`;

function createBoard(from: string): string {
  return `import type { JSX } from 'idlip/jsx-runtime';
import Counter from '${from}';
export default function Board(): JSX.Element { return <main><Counter start={1} /></main>; }
`;
}

const BOARD_ENTRY = `import Board from './board.tsx';
export function render() { return String(Board); }
`;

describe('plain .tsx files', () => {
  it('compiles a component imported from a .tsx file in the globs', async () => {
    const root = createApp({
      'src/board.tsx': createBoard('./counter.tsx'),
      'src/counter.tsx': COUNTER,
      'src/entry-server.ts': BOARD_ENTRY,
    });
    try {
      await build(root);
      const names = globSync('dist/client/assets/*.js', { cwd: root });
      expect(names.some((name) => name.includes('counter.handler.inc'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('names the modules option for a component from a file outside the globs', async () => {
    const root = createApp({
      'src/board.tsx': createBoard('../lib/counter.tsx'),
      'lib/counter.tsx': COUNTER,
      'src/entry-server.ts': BOARD_ENTRY,
    });
    try {
      await expect(build(root)).rejects.toThrow(
        /\/src\/board\.tsx renders a component from \/lib\/counter\.tsx, which the idlip plugin does not compile\. Add the file to the `modules` option/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('gives same-named files in different folders distinct chunks', async () => {
    const root = createApp({
      'src/a/todo.tsx': COUNTER,
      'src/b/todo.tsx': COUNTER,
      'src/entry-server.ts':
        "import A from './a/todo.tsx';\nexport function render() { return String(A); }\n",
    });
    try {
      await build(root);
      const names = globSync('dist/client/assets/todo.handler.inc*.js', { cwd: root });
      expect(names).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
