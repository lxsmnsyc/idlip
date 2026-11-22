import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { InlineConfig } from 'vite';
import { getChunkFile } from '../../src/core/format.ts';
import type { ChunkUrls, Compile, CompileResult, Manifest, Module } from '../../src/core/format.ts';
import { isChunkUrls, listChunks } from '../../src/vite/chunks.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const FIXTURES = path.join(PACKAGE, 'test/fixtures');
const REFERENCE = path.join(FIXTURES, 'reference.ts');
const CLIENT_STUB = path.join(PACKAGE, 'test/vite/client-stub.ts');

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readField(value: unknown, field: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
}

function isManifest(value: unknown): value is Manifest {
  return (
    typeof readField(value, 'module') === 'string' &&
    typeof readField(value, 'handlers') === 'object' &&
    typeof readField(value, 'groups') === 'object' &&
    typeof readField(value, 'lists') === 'object'
  );
}

/**
 * Reads a chunk URL map from a JSON file.
 */
export function readChunkUrls(file: string): ChunkUrls {
  const value = readJson(file);
  if (!isChunkUrls(value)) {
    throw new TypeError(`${file} is not a chunk URL map`);
  }
  return value;
}

/**
 * Stands in for `compile()` until `compile-integration` lands: returns the golden
 * fixture output for a module named after a fixture, such as `/src/todo.tsx`.
 */
export function compileFixture(_source: string, id: string): CompileResult {
  const name = path.basename(id, '.tsx');
  const expected = path.join(FIXTURES, name, 'expected');
  const manifest = readJson(path.join(expected, 'manifest.json'));
  if (!isManifest(manifest) || manifest.module !== id) {
    throw new Error(`The ${name} fixture has no manifest for ${id}`);
  }
  const client: Module[] = [];
  for (const chunk of listChunks(manifest)) {
    const code = readFileSync(path.join(expected, 'client', getChunkFile(chunk)), 'utf8');
    client.push({ chunk, code });
  }
  const server = readFileSync(path.join(expected, 'server.js'), 'utf8');
  return { server, client, manifest, diagnostics: [] };
}

/**
 * Returns a compiler that checks each source it gets equals the file on disk, so
 * the plugin compiles before Vite's JSX transform, then compiles the fixture.
 */
export function createCheckedCompile(root: string): { compile: Compile; calls: string[] } {
  const calls: string[] = [];
  function compile(source: string, id: string): CompileResult {
    calls.push(id);
    if (source !== readFileSync(path.join(root, id), 'utf8')) {
      throw new Error(`compile() got a transformed ${id}, not its source`);
    }
    return compileFixture(source, id);
  }
  return { compile, calls };
}

/**
 * Writes the fixture app into a new temporary folder and returns its root: the
 * counter and todo sources, a loader that imports nothing, and a server entry that
 * renders the todo at `/` and the counter at `/counter` with the fixture props.
 */
export function createApp(): string {
  // The real path, since Vite keys modules by it (`/var` is a link to `/private/var` on macOS).
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-vite-')));
  mkdirSync(path.join(root, 'src'));
  const props: Record<string, unknown> = {};
  for (const name of ['counter', 'todo']) {
    copyFileSync(path.join(FIXTURES, name, `${name}.tsx`), path.join(root, 'src', `${name}.tsx`));
    props[name] = readField(readJson(path.join(FIXTURES, name, 'input.json')), 'props');
  }
  // A loader that imports nothing from `idlip/client`, which the plugin rejects.
  writeFileSync(path.join(root, 'src/empty-loader.js'), 'export {};\n');
  // `ssr-render` ships `render()`. The reference state writer stands in for it.
  writeFileSync(
    path.join(root, 'src/entry-server.js'),
    `import { createContext } from ${JSON.stringify(REFERENCE)};
import Counter from './counter.tsx';
import TodoApp from './todo.tsx';

const props = ${JSON.stringify(props)};

export function render(url) {
  const { context, writeState } = createContext();
  const body = url === '/counter' ? Counter(props.counter, context) : TodoApp(props.todo, context);
  return '<!doctype html><html><head></head><body>' + body + writeState() + '</body></html>';
}
`,
  );
  return root;
}

/**
 * Returns the Vite config of the fixture app. The client input defaults to the
 * `idlip/client` stub, since `resume-loader` makes `idlip/client` the loader.
 */
export function createConfig(
  root: string,
  options: { compile?: Compile; client?: string } = {},
): InlineConfig {
  return {
    configFile: false,
    root,
    logLevel: 'silent',
    cacheDir: path.join(root, '.vite'),
    plugins: [
      idlip({
        entry: '/src/entry-server.js',
        compile: options.compile ?? createCheckedCompile(root).compile,
        client: options.client ?? CLIENT_STUB,
      }),
    ],
    resolve: {
      alias: {
        'idlip/client': CLIENT_STUB,
        'idlip/server': REFERENCE,
      },
    },
    // Bundle seroval into the server build, since the temporary root has no node_modules.
    ssr: { noExternal: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { fs: { allow: [root, PACKAGE] } },
    build: { minify: false },
  };
}
