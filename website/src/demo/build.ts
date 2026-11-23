// oxlint-disable import/prefer-default-export
// Builds `examples/todo` into the site, renders its page with idlip's own `render()`, and
// measures what the landing page shows about it.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { compile } from 'idlip/compiler';
import { renderListener } from 'idlip/server';
import { idlip } from 'idlip/vite';
import { createBuilder } from 'vite';
import { DEMO_DATA } from './data.ts';
import type { DemoData, DemoFile } from './data.ts';

const EXAMPLE = fileURLToPath(new URL('../../../examples/todo/', import.meta.url));
const STYLES = fileURLToPath(new URL('../styles.css', import.meta.url));
const FRAME_STYLES = fileURLToPath(new URL('frame.css', import.meta.url));

interface PageModule {
  render(url: string, options: { loader: string }): Promise<string>;
}

function isPageModule(value: unknown): value is PageModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'render') === 'function'
  );
}

function measure(bytes: Buffer | string, filePath: string, name: string): DemoFile {
  const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
  return { path: filePath, name, raw: buffer.length, gzip: gzipSync(buffer, { level: 9 }).length };
}

/** The tokens of the site, between the markers in `styles.css`, so the frame has the same colors. */
function readTokens(): string {
  const css = readFileSync(STYLES, 'utf8');
  const start = css.indexOf('/* tokens:start */');
  const end = css.indexOf('/* tokens:end */');
  if (start === -1 || end === -1) {
    throw new Error(`${STYLES} has no tokens:start and tokens:end markers`);
  }
  return css.slice(start, end);
}

/** Drops the hash from a built file name: `todo.handler.toggle.OCN4PWUm.js` is `todo.handler.toggle.js`. */
function dropHash(file: string): string {
  return file.replace(/\.[\w-]+\.js$/, '.js');
}

function findFile(files: readonly DemoFile[], name: string): DemoFile {
  for (const file of files) {
    if (file.name === name || file.path === name) {
      return file;
    }
  }
  throw new Error(`The demo build has no ${name}`);
}

/** The built files of the client output by the module id each one comes from. */
function listOutput(output: unknown): Map<string, string> {
  const files = new Map<string, string>();
  const results: unknown[] = Array.isArray(output) ? output : [output];
  for (const result of results) {
    const items: unknown =
      typeof result === 'object' && result !== null ? Reflect.get(result, 'output') : undefined;
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items as unknown[]) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const id: unknown = Reflect.get(item, 'facadeModuleId');
      const fileName: unknown = Reflect.get(item, 'fileName');
      if (typeof id === 'string' && typeof fileName === 'string') {
        files.set(id, fileName);
      }
    }
  }
  return files;
}

/**
 * The built file of a manifest chunk, such as `handler=toggle`: the one output chunk whose module
 * id holds that name. The file name rule stays in idlip.
 */
function findChunkFile(output: ReadonlyMap<string, string>, chunk: string): string {
  const found: string[] = [];
  for (const [id, fileName] of output) {
    if (id.includes(chunk)) {
      found.push(fileName);
    }
  }
  if (found.length !== 1) {
    throw new Error(`The demo build has ${found.length} chunks for ${chunk}, not 1`);
  }
  return found[0];
}

/** The first argument of a checkbox message: `a2` in `["toggle",["a2"]]`. */
function readMessageId(token: string): string {
  const message: unknown = JSON.parse(token);
  const args: unknown = Array.isArray(message) ? message[1] : undefined;
  return Array.isArray(args) && typeof args[0] === 'string' ? args[0] : '';
}

/**
 * Reads the todos of the first render from the markup: the id the checkbox message names, the
 * text of each row and its checkbox.
 */
function readTodos(body: string): { id: string; text: string; done: boolean }[] {
  const todos: { id: string; text: string; done: boolean }[] = [];
  for (const match of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
    const text = /<!--t\d+-->([\s\S]*?)<!--\/t-->/.exec(match[1])?.[1];
    const token = /on:click='([^']*)'/.exec(match[1])?.[1];
    if (text === undefined || token === undefined) {
      throw new Error(`The demo row has no text binding or no message: ${match[0]}`);
    }
    todos.push({
      id: readMessageId(token),
      text: text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'),
      done: /\bchecked\b/.test(match[1]),
    });
  }
  if (todos.length === 0) {
    throw new Error('The demo page has no todo rows');
  }
  return todos;
}

/**
 * Builds the demo into `<outDir>/demo/`, writes its page as `<outDir>/demo/index.html`, and
 * writes the measurements to `DEMO_DATA`.
 */
export async function buildDemo(outDir: string, base: string): Promise<DemoData> {
  const clientDir = path.join(outDir, 'demo');
  const serverDir = path.dirname(DEMO_DATA);

  // Build the client chunks and the server entry of the example, with the site's base. Skew
  // retention is off: each site build replaces the whole folder.
  const builder = await createBuilder({
    configFile: false,
    root: EXAMPLE,
    base: `${base}demo/`,
    logLevel: 'warn',
    plugins: [idlip({ entry: '/src/entry-server.ts', skew: false })],
    environments: {
      client: {
        build: {
          outDir: clientDir,
          emptyOutDir: true,
          rolldownOptions: {
            input: { loader: 'idlip/client' },
            output: {
              entryFileNames: 'assets/[name].[hash].js',
              chunkFileNames: 'assets/[name].[hash].js',
            },
          },
        },
      },
      ssr: { build: { outDir: serverDir, emptyOutDir: true } },
    },
  });
  const output = listOutput(await builder.build(builder.environments.client));
  await builder.build(builder.environments.ssr);

  // Measure every built file. The loader is the entry, the rest are the chunks of the component.
  const files: DemoFile[] = [];
  for (const name of readdirSync(path.join(clientDir, 'assets')).toSorted()) {
    files.push(
      measure(
        readFileSync(path.join(clientDir, 'assets', name)),
        `demo/assets/${name}`,
        dropHash(name),
      ),
    );
  }
  const loader = findFile(files, 'loader.js');
  const chunks: DemoFile[] = [];
  for (const file of files) {
    if (file !== loader) {
      chunks.push(file);
    }
  }

  // Render the page with the example's own entry, then add the frame styles to its head.
  const loaded: unknown = await import(pathToFileURL(path.join(serverDir, 'entry-server.js')).href);
  if (!isPageModule(loaded)) {
    throw new TypeError('The demo server entry exports no render(url, options)');
  }
  const page = await loaded.render('/', { loader: `${base}${loader.path}` });
  const styles = `${readTokens()}\n${readFileSync(FRAME_STYLES, 'utf8')}`
    .replaceAll('url(/fonts/', `url(${base}fonts/`)
    .replaceAll(/\s*\n\s*/g, ' ');
  const html = page.replace('</head>', `<style>${styles}</style></head>`);
  writeFileSync(path.join(clientDir, 'index.html'), html);

  // Read the names the landing page explains from the markup and the compiled manifest.
  const body = html.slice(html.indexOf('<body>'));
  const rows = [...body.matchAll(/<li\b[\s\S]*?<\/li>/g)];
  const row = rows[1]?.[0] ?? '';
  const token = /on:click='([^']*)'/.exec(row)?.[1] ?? '';
  const message: unknown = JSON.parse(token);
  const handlerName = Array.isArray(message) && typeof message[0] === 'string' ? message[0] : '';
  const source = readFileSync(path.join(EXAMPLE, 'src/todo.tsx'), 'utf8');
  const { manifest } = compile(source, '/src/todo.tsx');
  if (!Object.hasOwn(manifest.handlers, handlerName)) {
    throw new Error(`The manifest has no handler ${handlerName}`);
  }
  const handlerEntry = manifest.handlers[handlerName];
  const bindings: readonly string[] = handlerEntry.bindings ?? [];
  const writes: string[] = [...(handlerEntry.writes ?? [])];
  if (bindings.length !== 1 || !Object.hasOwn(manifest.groups, bindings[0])) {
    throw new Error(`The diagram needs ${handlerName} to update one binding group`);
  }
  const group = manifest.groups[bindings[0]];
  const handlerFile = findChunkFile(output, handlerEntry.chunk);
  const bindingFile = findChunkFile(output, group.chunk);

  // The diagram shows the clicked row turning done and the count going down, then the binding
  // patching that row and the count. Fail the build when the example stops matching that.
  const todos = readTodos(body);
  const rowId = /^<li i-a="(\d+)"/.exec(row)?.[1];
  if (todos.length < 2 || todos[1].done) {
    throw new Error('The diagram needs the second todo of the demo to start not done');
  }
  if (
    rowId === undefined ||
    !group.bindings.includes(`a${rowId}`) ||
    !group.covers.includes('todos')
  ) {
    throw new Error(`The ${group.chunk} chunk no longer patches the row and the count`);
  }

  // The loader fetches the shared helpers with the first handler, so a click loads them too.
  const helpersUrl = /[{,]"?helpers"?:"([^"]+)"/.exec(body)?.[1];
  const helpers =
    helpersUrl === undefined ? undefined : findFile(files, helpersUrl.slice(base.length));

  const data: DemoData = {
    frame: 'demo/',
    document: measure(page, 'demo/', 'demo/'),
    listener: measure(
      /<script[^>]*>([\s\S]*)<\/script>/.exec(renderListener())?.[1] ?? '',
      '',
      'listener',
    ),
    loader,
    handler: findFile(files, `demo/${handlerFile}`),
    binding: findFile(files, `demo/${bindingFile}`),
    helpers,
    chunks,
    handlerName,
    token,
    writes,
    row,
    state: /<script i-state[^>]*>[\s\S]*?<\/script>/.exec(body)?.[0] ?? '',
    todos,
  };
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(DEMO_DATA, JSON.stringify(data, null, 2));
  return data;
}
