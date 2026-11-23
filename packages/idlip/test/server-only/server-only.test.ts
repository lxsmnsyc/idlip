import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { idlip } from '../../src/vite/index.ts';
import { isBuiltIn, isPublicKey, scanModule } from '../../src/vite/server-only.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

const roots: string[] = [];

/** Builds an app of the given files, and returns the error message of a failed build or ''. */
async function build(files: Record<string, string>, envPrefix?: string): Promise<string> {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-server-only-')));
  roots.push(root);
  writeFileSync(`${root}/package.json`, JSON.stringify({ name: 'app', type: 'module' }));
  const all = {
    ...files,
    'src/entry-server.js': `import { renderToResponse } from 'idlip/server';
import App from './app.tsx';
export default { fetch() { return renderToResponse(App, {}, { preload: false }); } };
`,
  };
  for (const [file, source] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
  try {
    const builder = await createBuilder({
      configFile: false,
      root,
      logLevel: 'silent',
      cacheDir: path.join(root, '.vite'),
      ...(envPrefix === undefined ? {} : { envPrefix }),
      plugins: [idlip({ entry: '/src/entry-server.js', client: CLIENT })],
      resolve: {
        alias: {
          'idlip/client': CLIENT,
          'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
        },
      },
      build: { minify: false },
    });
    await builder.buildApp();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function printApp(top: string, body: string, view: string): string {
  return `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
${top}

export default function App(): JSX.Element {
  let count = 0;
  ${body}
  return <main>${view}</main>;
}
`;
}

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('scanModule', () => {
  it('reads imports and env keys, and skips types', () => {
    const scan = scanModule(
      'a.ts',
      `import type { A } from 'node:fs';
import { b } from './b.ts';
export * from 'c';
export { d } from 'd';
const x = import.meta.env.SECRET + import.meta.env['TOKEN'];
const y = import('e');
`,
    );
    expect(scan.imports).toEqual(['./b.ts', 'c', 'd', 'e']);
    expect(scan.keys).toEqual(['SECRET', 'TOKEN']);
  });

  it('tells built-ins and public keys', () => {
    expect(isBuiltIn('node:fs')).toBe(true);
    expect(isBuiltIn('fs/promises')).toBe(true);
    expect(isBuiltIn('./fs')).toBe(false);
    expect(isBuiltIn('seroval')).toBe(false);
    expect(isPublicKey('VITE_A', ['VITE_'])).toBe(true);
    expect(isPublicKey('MODE', ['VITE_'])).toBe(true);
    expect(isPublicKey('SECRET', ['VITE_'])).toBe(false);
  });
});

describe('server-only code in a client chunk', () => {
  it('fails a handler that reaches node: through imports, naming the chain', async () => {
    const message = await build({
      'src/db.ts': `import { readFileSync } from 'node:fs';\nexport function load(n: number) { return readFileSync('x').length + n; }\n`,
      'src/app.tsx': printApp(
        `import { load } from './db.ts';`,
        `function add() { count = load(count); }`,
        `<button on:click={add}>{count}</button>`,
      ),
    });
    expect(message).toContain(
      'idlip: the client chunk handler=add of /src/app.tsx imports a Node.js module: /src/app.tsx > handler=add > /src/db.ts > node:fs.',
    );
  });

  it('fails a binding that imports a bare built-in', async () => {
    const message = await build({
      'src/fmt.ts': `import { join } from 'path';\nexport function fmt(n: number) { return join('a', String(n)); }\n`,
      'src/app.tsx': printApp(
        `import { fmt } from './fmt.ts';`,
        `function add() { count = count + 1; }`,
        `<button on:click={add}>{fmt(count)}</button>`,
      ),
    });
    expect(message).toContain('/src/fmt.ts > path.');
  });

  it('fails a derived const that reaches node:', async () => {
    const message = await build({
      'src/fmt.ts': `import { sep } from 'node:path';\nexport function fmt(n: number) { return sep + n; }\n`,
      'src/app.tsx': printApp(
        `import { fmt } from './fmt.ts';`,
        `const label = fmt(count);\n  function add() { count = count + 1; }`,
        `<button on:click={add}>{label}</button>`,
      ),
    });
    expect(message).toContain('/src/fmt.ts > node:path.');
  });

  it('fails a handler that reads a private env key through an import', async () => {
    const message = await build({
      'src/env.ts': `export const token = import.meta.env.SECRET_TOKEN;\n`,
      'src/app.tsx': printApp(
        `import { token } from './env.ts';`,
        `function add() { count = count + token.length; }`,
        `<button on:click={add}>{count}</button>`,
      ),
    });
    expect(message).toContain(
      'idlip: the client chunk handler=add of /src/app.tsx reads import.meta.env.SECRET_TOKEN, which the browser does not get: /src/app.tsx > handler=add > /src/env.ts.',
    );
  });

  it('fails a private key in a module-level binding of the component', async () => {
    const message = await build({
      'src/app.tsx': printApp(
        `const KEY = import.meta.env.SECRET_TOKEN;`,
        `function add() { count = count + KEY.length; }`,
        `<button on:click={add}>{count}</button>`,
      ),
    });
    expect(message).toContain('import.meta.env.SECRET_TOKEN');
    expect(message).toContain('/src/app.tsx > handler=add.');
  });

  it('passes public keys, Vite keys and a custom prefix', async () => {
    const message = await build({
      'src/env.ts': `export const a = import.meta.env.VITE_NAME;\nexport const b = import.meta.env.MODE;\n`,
      'src/app.tsx': printApp(
        `import { a, b } from './env.ts';`,
        `function add() { count = count + a.length + b.length; }`,
        `<button on:click={add}>{count}</button>`,
      ),
    });
    expect(message).toBe('');
    const custom = await build(
      {
        'src/env.ts': `export const a = import.meta.env.PUBLIC_NAME;\n`,
        'src/app.tsx': printApp(
          `import { a } from './env.ts';`,
          `function add() { count = count + a.length; }`,
          `<button on:click={add}>{count}</button>`,
        ),
      },
      'PUBLIC_',
    );
    expect(custom).toBe('');
  });

  it('passes a server-only import used only in the server render', async () => {
    const message = await build({
      'src/app.tsx': printApp(
        `import { readFileSync } from 'node:fs';\nconst secret = readFileSync(import.meta.filename, 'utf8').length;\nconst KEY = import.meta.env.SECRET_TOKEN;`,
        `function add() { count = count + 1; }`,
        `<button on:click={add}>{count}</button>`,
      ),
    });
    expect(message).toBe('');
  });
});
