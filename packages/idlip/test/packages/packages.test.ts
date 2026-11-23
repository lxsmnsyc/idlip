import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBuilder, resolveConfig } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findPackage,
  getPackageFile,
  getPackageId,
  readPackages,
} from '../../src/vite/packages.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');

/** The source of a component package's `button.tsx`: a stateful button with a stylesheet. */
function printButton(label: string): string {
  return `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import './button.css';

export default function Button(): JSX.Element {
  let count = 0;

  function press() {
    count = count + 1;
  }

  return <button class="${label}" on:click={press}>${label} {count}</button>;
}
`;
}

/** Writes files under a folder: path to source. */
function writeFiles(root: string, files: Record<string, string>): void {
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
}

function printPackage(name: string, field: unknown): string {
  return JSON.stringify({
    name,
    version: '1.0.0',
    type: 'module',
    // A published package exports its files by path.
    exports: { './src/*.tsx': './src/*.tsx' },
    ...(field === undefined ? {} : { idlip: field }),
  });
}

function printApp(names: readonly string[]): string {
  const dependencies: Record<string, string> = {};
  for (const name of names) {
    dependencies[name] = '1.0.0';
  }
  return JSON.stringify({ name: 'app', type: 'module', dependencies });
}

function createRoot(): string {
  // The real path, since Vite names modules by it.
  return realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-packages-')));
}

describe('readPackages', () => {
  let root = '';

  beforeAll(() => {
    root = createRoot();
    writeFiles(root, {
      'package.json': printApp(['@acme/a', 'plain', 'whole', 'missing']),
      'node_modules/@acme/a/package.json': printPackage('@acme/a', { version: 1, dir: 'src' }),
      'node_modules/plain/package.json': printPackage('plain', undefined),
      'node_modules/whole/package.json': printPackage('whole', { version: 1 }),
      'node_modules/@acme/a/src/button.tsx': printButton('a'),
      'node_modules/@acme/a/src/nested/node_modules/dep/index.tsx': printButton('dep'),
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads only the dependencies that have an idlip field', () => {
    const packages = readPackages(root);
    expect(packages.map((info) => info.name)).toEqual(['@acme/a', 'whole']);
    expect(packages[0].src).toBe(`${packages[0].dir}/src`);
    // Without `dir`, the package folder holds the components.
    expect(packages[1].src).toBe(packages[1].dir);
  });

  it('names a module by the package and the path in it, and finds the file again', () => {
    const packages = readPackages(root);
    const file = `${packages[0].dir}/src/button.tsx`;
    expect(findPackage(packages, file)).toBe(packages[0]);
    const id = getPackageId(packages[0], file);
    expect(id).toBe('@acme/a/src/button.tsx');
    expect(getPackageFile(packages, id)).toBe(file);
    expect(getPackageFile(packages, '/src/app.tsx')).toBeUndefined();
    // A file of a nested `node_modules` is not the package's own.
    expect(
      findPackage(packages, `${packages[0].dir}/src/nested/node_modules/dep/index.tsx`),
    ).toBeUndefined();
  });

  it('accepts a folder whose name starts with two dots', () => {
    const other = createRoot();
    writeFiles(other, {
      'package.json': printApp(['dots']),
      'node_modules/dots/package.json': printPackage('dots', { version: 1, dir: '..src' }),
      'node_modules/dots/..src/button.tsx': printButton('a'),
    });
    expect(readPackages(other)[0].src).toMatch(/\/dots\/\.\.src$/);
    rmSync(other, { recursive: true, force: true });
  });

  it('rejects a dir that links outside the package', () => {
    const other = createRoot();
    writeFiles(other, {
      'package.json': printApp(['linked']),
      'node_modules/linked/package.json': printPackage('linked', { version: 1, dir: 'src' }),
      'outside/button.tsx': printButton('a'),
    });
    symlinkSync(path.join(other, 'outside'), path.join(other, 'node_modules/linked/src'));
    expect(() => readPackages(other)).toThrow('linked sets idlip.dir outside the package: src.');
    rmSync(other, { recursive: true, force: true });
  });

  it('rejects two packages whose names give the same chunk name', () => {
    const other = createRoot();
    writeFiles(other, {
      'package.json': printApp(['@a/b-c', '@a-b/c']),
      'node_modules/@a/b-c/package.json': printPackage('@a/b-c', { version: 1 }),
      'node_modules/@a-b/c/package.json': printPackage('@a-b/c', { version: 1 }),
    });
    expect(() => readPackages(other)).toThrow(
      '@a-b/c and @a/b-c both name their chunks "a-b-c". Use only one.',
    );
    rmSync(other, { recursive: true, force: true });
  });

  it('rejects a dir outside the package', () => {
    const other = createRoot();
    writeFiles(other, {
      'package.json': printApp(['bad']),
      'node_modules/bad/package.json': printPackage('bad', { version: 1, dir: '../x' }),
    });
    expect(() => readPackages(other)).toThrow('bad sets idlip.dir outside the package: ../x.');
    rmSync(other, { recursive: true, force: true });
  });
});

describe('a package with another format version', () => {
  let root = '';

  beforeAll(() => {
    root = createRoot();
    writeFiles(root, {
      'package.json': printApp(['@acme/old']),
      'node_modules/@acme/old/package.json': printPackage('@acme/old', { version: 2, dir: 'src' }),
      'node_modules/@acme/old/src/button.tsx': printButton('old'),
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('fails the start with the package and the version', async () => {
    await expect(
      resolveConfig({ configFile: false, root, logLevel: 'silent', plugins: [idlip()] }, 'build'),
    ).rejects.toThrow('@acme/old uses idlip package format 2; this idlip reads format 1.');
  });

  it('fails when the version is missing', async () => {
    writeFiles(root, {
      'node_modules/@acme/old/package.json': printPackage('@acme/old', { dir: 'src' }),
    });
    await expect(
      resolveConfig({ configFile: false, root, logLevel: 'silent', plugins: [idlip()] }, 'build'),
    ).rejects.toThrow('@acme/old uses idlip package format undefined; this idlip reads format 1.');
  });
});

describe('two packages with a file of the same name', () => {
  let root = '';
  let html = '';

  beforeAll(async () => {
    root = createRoot();
    writeFiles(root, {
      'package.json': printApp(['@acme/a', '@acme/b']),
      'node_modules/@acme/a/package.json': printPackage('@acme/a', { version: 1, dir: 'src' }),
      'node_modules/@acme/a/src/button.tsx': printButton('a'),
      'node_modules/@acme/a/src/button.css': '.a { color: rgb(1, 2, 3); }\n',
      'node_modules/@acme/b/package.json': printPackage('@acme/b', { version: 1, dir: 'src' }),
      'node_modules/@acme/b/src/button.tsx': printButton('b'),
      'node_modules/@acme/b/src/button.css': '.b { color: rgb(4, 5, 6); }\n',
      'src/app.tsx': `// oxlint-disable
import type { JSX } from 'idlip/jsx-runtime';
import ButtonA from '@acme/a/src/button.tsx';
import ButtonB from '@acme/b/src/button.tsx';

export default function App(): JSX.Element {
  let shown = true;

  function hide() {
    shown = false;
  }

  return (
    <html lang="en">
      <head>
        <title>packages</title>
      </head>
      <body>
        <ButtonA />
        <ButtonB />
        <button on:click={hide}>hide</button>
      </body>
    </html>
  );
}
`,
      'src/entry-server.js': `import { renderToResponse } from 'idlip/server';
import App from './app.tsx';

export default {
  fetch() {
    return renderToResponse(App, {}, { preload: false });
  },
};
`,
    });
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
      build: { minify: false },
    });
    await builder.buildApp();
    const entry = path.join(root, 'dist/server/entry-server.js');
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
    html = await answer.text();
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('builds a chunk of each package under its own name', () => {
    const files = readdirSync(path.join(root, 'dist/client/assets'));
    const names: string[] = [];
    for (const name of files) {
      const match = /^(.+\.handler\.press)-/.exec(name);
      if (match !== null) {
        names.push(match[1]);
      }
    }
    expect(names.toSorted()).toEqual([
      'acme-a.button.handler.press',
      'acme-b.button.handler.press',
    ]);
  });

  it('keys the chunk map of each package by its module id', () => {
    const map: unknown = JSON.parse(
      readFileSync(path.join(root, 'dist/.idlip/chunks.json'), 'utf8'),
    );
    expect(Reflect.get(Object(map), '@acme/a/src/button.tsx?idlip-handler=press&lang.js')).toMatch(
      /acme-a\.button/,
    );
    expect(Reflect.get(Object(map), '@acme/b/src/button.tsx?idlip-handler=press&lang.js')).toMatch(
      /acme-b\.button/,
    );
  });

  it('renders both components, each with its own chunk URLs in the state', () => {
    expect(html).toContain('<button class="a"');
    expect(html).toContain('<button class="b"');
    expect(html).toMatch(/acme-a\.button\.handler\.press/);
    expect(html).toMatch(/acme-b\.button\.handler\.press/);
  });

  it('links the stylesheet of each package, though the package is installed in node_modules', () => {
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    let linked = '';
    for (const link of links) {
      linked += readFileSync(path.join(root, 'dist/client', link), 'utf8');
    }
    expect(linked).toContain('rgb(1, 2, 3)');
    expect(linked).toContain('rgb(4, 5, 6)');
  });
});
