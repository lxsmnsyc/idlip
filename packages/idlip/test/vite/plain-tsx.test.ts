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
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { readChunkUrls } from './app.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

function createApp(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-plain-')));
  // Plain JSX in a file the plugin leaves alone needs a runtime.
  writeFileSync(
    path.join(root, 'jsx-stub.js'),
    'export const jsx = () => null;\nexport const jsxDEV = jsx;\nexport const Fragment = null;\n',
  );
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), source);
  }
  return root;
}

async function build(root: string, warnings: string[] = []): Promise<void> {
  const builder = await createBuilder({
    configFile: false,
    root,
    logLevel: 'silent',
    customLogger: {
      info() {},
      warn(message) {
        warnings.push(message);
      },
      warnOnce(message) {
        warnings.push(message);
      },
      error() {},
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
    cacheDir: path.join(root, '.vite'),
    resolve: {
      alias: {
        'react/jsx-dev-runtime': path.join(root, 'jsx-stub.js'),
        'react/jsx-runtime': path.join(root, 'jsx-stub.js'),
        'idlip/client': CLIENT,
        'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
      },
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

const ENTRY = `import Counter from './counter.tsx';\nexport function render() { return String(Counter); }\n`;

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

  it('leaves a .tsx file with no component to Vite', async () => {
    const root = createApp({
      'src/main.tsx': 'const node = <div />;\nconsole.log(typeof node);\nexport {};\n',
      'src/helpers.tsx': 'export const label = <b />;\n',
      'src/counter.tsx': COUNTER,
      'src/entry-server.ts': "import './main.tsx';\nimport './helpers.tsx';\n" + ENTRY,
    });
    try {
      await build(root);
      expect(globSync('dist/client/assets/counter.handler.inc*.js', { cwd: root })).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('warns about a component in a file outside the globs', async () => {
    const root = createApp({
      'lib/counter.tsx': COUNTER,
      'src/entry-server.ts':
        "import Counter from '../lib/counter.tsx';\nexport function render() { return String(Counter); }\n",
      'src/other.tsx': COUNTER,
    });
    const warnings: string[] = [];
    try {
      await build(root, warnings);
      expect(warnings.join('\n')).toMatch(
        /\/lib\/counter\.tsx holds a component but is outside the `modules` option of idlip\(\)/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('gives same-named files in different folders distinct chunk URLs and code', async () => {
    const root = createApp({
      'src/a/todo.tsx': COUNTER.replace('count += 1', 'count += 111'),
      'src/b/todo.tsx': COUNTER.replace('count += 1', 'count += 222'),
      'src/entry-server.ts':
        "import A from './a/todo.tsx';\nimport B from './b/todo.tsx';\nexport function render() { return String(A) + String(B); }\n",
    });
    try {
      await build(root);
      const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
      const a = urls['/src/a/todo.tsx?idlip-handler=inc&lang.js'];
      const b = urls['/src/b/todo.tsx?idlip-handler=inc&lang.js'];
      expect(a).not.toBe(b);
      expect(readFileSync(path.join(root, 'dist/client', a), 'utf8')).toContain('111');
      expect(readFileSync(path.join(root, 'dist/client', b), 'utf8')).toContain('222');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
