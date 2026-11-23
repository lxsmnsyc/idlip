import { globSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { Readable, pipeline } from 'node:stream';
import type { ReadableStream as NodeStream } from 'node:stream/web';
import path from 'node:path';
import { isRunnableDevEnvironment } from 'vite';
import type {
  BuildEnvironment,
  Connect,
  EnvironmentOptions,
  Plugin,
  Rolldown,
  UserConfig,
  ViteDevServer,
} from 'vite';
import * as compiler from '../compiler/index.ts';
import { HELPERS_MODULE, printHelpersModule } from '../core/helpers.ts';
import type { CompileOptions } from '../compiler/index.ts';
import type { ChunkUrls, Compile, CompileDiagnostic, CompileResult } from '../core/format.ts';
import {
  HELPERS_KEY,
  LOADER_KEY,
  TEMPLATES_KEY,
  TEMPLATES_MODULE,
  getChunkFile,
  getChunkId,
  listCompiled,
  printTemplatesModule,
  splitModule,
} from '../core/format.ts';
import { getDefines, getFeatures, replaceFeatures } from './features.ts';
import { HOT_EVENT, changesShell, classifyEdit } from './hot.ts';
import {
  BUILDS_FILE,
  BUILD_FILE,
  BUILD_KEY,
  findLoaderFile,
  getBuildId,
  getBuildSource,
  keepBuilds,
} from './skew.ts';
import { isChunkUrls, listChunks, parseChunkId, replaceChunkUrls } from './chunks.ts';
import { STYLES_KEY } from '../server/styles.ts';
import { checkServerOnly, readSource } from './server-only.ts';
import type { ScanCache } from './server-only.ts';
import {
  findPackage,
  getPackageFile,
  getPackageId,
  getPackageSlug,
  listPackageFiles,
  readPackages,
} from './packages.ts';
import type { IdlipPackage } from './packages.ts';
import { STYLES_PREFIX, cleanId, isScript, isStyle, isStyleModule, listImports } from './styles.ts';

const MODULE_FILE = /\.tsx$/;

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
/**
 * The chunk URL map of the client build, under `build.outDir` and outside the served client
 * folder, for a server build in another process.
 */
const CHUNKS_FILE = '.idlip/chunks.json';
/**
 * The module a dev page's `<script src="/@id/idlip/client">` loads: a proxy that imports
 * `idlip/client`. The import resolves to the URL that chunks import, so the loader runs once.
 */
const DEV_LOADER = '\0idlip:dev-loader';
/** The URL of the loader that dev pages write. */
const DEV_LOADER_URL = '/@id/idlip/client';

/** The module chunks import their helpers from (`idlip/helpers`), written by `printHelpersModule`. */
const HELPERS_ID = '\0idlip-helpers';
/** The module chunks import the templates of more than one chunk from (`idlip/templates`). */
const TEMPLATES_ID = '\0idlip-templates';
/** The name of the plugin that Nitro's Vite integration registers. */
const NITRO_PLUGIN = 'nitro:main';
/**
 * The id prefix of the client entry that imports the stylesheets of one module file. Nothing
 * loads the entry: the bundler writes the stylesheets that it imports, and the plugin reads their
 * names.
 */
const STYLES_ID = '\0idlip-styles:';
/**
 * The id prefix of a module that holds the class names of a CSS Module for one chunk: the object
 * the stylesheet exports, inlined in the chunk. Why: a chunk that imported the stylesheet's own
 * module would share it with the other chunks, and a click would load that file.
 */
const NAMES_ID = '\0idlip-names:';
/** A stylesheet import that asks for the text or the URL, not for a link on the page. */
const STYLE_QUERY = /[?&](?:inline|url|raw)(?:&|=|$)/;
/** A default import in chunk code: `import styles from "./todo.module.css";`. */
const DEFAULT_IMPORT = /^import\s+(\w+)\s+from\s+(["'])([^"'\n]+)\2;?[ \t]*$/gm;
/** The default `modules` globs. */
const DEFAULT_MODULES = ['src/**/*.tsx'];
/** The id of a child's view chunk, with the component's name for a named component. */
const VIEW_CHUNK = /\?idlip-(?:[A-Z][^.&=?]*\.)?view&lang\.js$/;
/**
 * The id of a chunk that can render a child with its view: a list's item template, a binding
 * chunk that renders a condition branch, or a `<Try>` region.
 */
const RENDER_CHUNK = /\?idlip-(?:[A-Z][^.&=?]*\.)?(?:list|binding|try)=[^&]*&lang\.js$/;

export interface IdlipOptions {
  /** Globs of the idlip modules, relative to the root. Default: `src/**\/*.tsx`. */
  modules?: string | readonly string[];
  /**
   * The server entry, such as `/src/entry-server.ts`. Its default export is `{ fetch(request) }`,
   * which returns the page as a `Response`: Nitro calls it, and so does the dev middleware of
   * this plugin when Nitro is not there. It is also the input of the ssr build when the config
   * sets none.
   */
  entry?: string;
  /**
   * `false` keeps the plugin's dev middleware off, for a project whose own server renders the
   * pages. The middleware is off already when the config has Nitro (`nitro()` from
   * `nitro/vite`), which calls the entry itself.
   */
  server?: false;
  /**
   * The input of the client build: the loader. Default: `idlip/client`. Every module an idlip
   * chunk imports must be in its static graph, so a click loads no shared chunk.
   */
  client?: string;
  /** The compiler. Default: `compile` from `idlip/compiler`. */
  compile?: (source: string, id: string, options?: CompileOptions) => CompileResult;
  /**
   * Recover when a page cached from an older build meets this one: the pages carry a build id,
   * the client build keeps the files of the previous build, and the loader reloads once when a
   * chunk fails and the server runs another build. Default: on in a production build.
   *
   * The client build writes `build.js` next to the loader. Serve it with `Cache-Control:
   * no-store` (or a short max age), since the loader imports it to learn the build the server
   * runs, and a cached copy hides a new deploy. Retention reads `<build.outDir>/.idlip/builds.json`,
   * so keep `build.outDir` between deploys, or restore the previous build before building.
   * On a clean checkout the build keeps nothing, and a page cached from the last deploy finds its
   * chunks gone and reloads. Only files of the build are deleted, never files from `publicDir`.
   */
  skew?: boolean;
}

/** The context methods the plugin reports diagnostics with. */
interface Reporter {
  warn(message: string): void;
  error(message: string): never;
}

function isCompile(value: unknown): value is Compile {
  return typeof value === 'function';
}

/**
 * Returns `compile` from `idlip/compiler`. It throws until `compile-integration`
 * exports it.
 */
function getDefaultCompile(): NonNullable<IdlipOptions['compile']> {
  const value: unknown = Reflect.get(compiler, 'compile');
  if (!isCompile(value)) {
    throw new TypeError('idlip/compiler exports no compile() yet. Pass `compile` to idlip().');
  }
  return value;
}

/**
 * Returns the 1-based line and column of an offset.
 */
function getPosition(source: string, offset: number): string {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return `${line}:${column}`;
}

function reportDiagnostics(
  reporter: Reporter,
  file: string,
  source: string,
  diagnostics: readonly CompileDiagnostic[],
): void {
  const errors: string[] = [];
  for (const diagnostic of diagnostics) {
    const text = `${file}:${getPosition(source, diagnostic.span.start)} ${diagnostic.rule}: ${diagnostic.message}`;
    if (diagnostic.severity === 'error') {
      errors.push(text);
    } else {
      reporter.warn(text);
    }
  }
  if (errors.length > 0) {
    reporter.error(errors.join('\n'));
  }
}

/**
 * Returns the build options of one environment the plugin defaults: `<outDir>/<folder>`
 * and the input, each unless the user config sets it.
 */
function createBuild(
  user: EnvironmentOptions | undefined,
  outDir: string,
  input: string | undefined,
  keep = false,
): NonNullable<EnvironmentOptions['build']> {
  return {
    ...(user?.build?.outDir === undefined ? { outDir } : {}),
    // The previous build's files stay for pages cached from it. `keepBuilds` drops older ones.
    ...(keep && user?.build?.emptyOutDir === undefined ? { emptyOutDir: false } : {}),
    ...(input === undefined || user?.build?.rolldownOptions?.input !== undefined
      ? {}
      : { rolldownOptions: { input } }),
  };
}

/**
 * Sets the build defaults the plugin needs, unless the user config sets them: an app
 * build of client and ssr, the client and server folders under `build.outDir`, and the
 * inputs of both.
 */
function createConfig(
  user: UserConfig,
  options: IdlipOptions,
  packages: readonly IdlipPackage[],
): UserConfig {
  const environments: Partial<Record<string, EnvironmentOptions>> = user.environments ?? {};
  const outDir = user.build?.outDir ?? 'dist';
  const names = packages.map((info) => info.name);
  return {
    // A component package reaches the plugin as source: Vite neither bundles it for the browser
    // nor leaves it external on the server, and the app and its packages share one runtime.
    ...(names.length === 0
      ? {}
      : {
          ssr: { noExternal: names },
          optimizeDeps: { exclude: names },
          resolve: { dedupe: ['idlip'] },
        }),
    builder: {},
    environments: {
      client: {
        build: createBuild(
          environments.client,
          path.join(outDir, 'client'),
          options.client ?? 'idlip/client',
          options.skew !== false,
        ),
      },
      ssr: { build: createBuild(environments.ssr, path.join(outDir, 'server'), options.entry) },
    },
  };
}

/**
 * Fails the client build when an idlip chunk imports a module outside the loader's
 * static graph, since a click would then load that module too.
 */
function checkChunkImports(
  reporter: Reporter,
  bundle: Rolldown.OutputBundle,
  chunkFiles: ReadonlySet<string>,
  sharedFiles: readonly string[],
  styleFiles: ReadonlySet<string> = new Set(),
): void {
  const items: Partial<Rolldown.OutputBundle> = bundle;
  // Walk the static imports from every entry that is not an idlip chunk.
  const loaded = new Set<string>();
  const pending: string[] = [];
  for (const item of Object.values(bundle)) {
    if (
      item.type === 'chunk' &&
      item.isEntry &&
      !chunkFiles.has(item.fileName) &&
      !styleFiles.has(item.fileName)
    ) {
      pending.push(item.fileName);
    }
  }
  // An external import is not in the bundle. It counts as loaded once the loader imports it.
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (loaded.has(file)) {
      continue;
    }
    loaded.add(file);
    const item = items[file];
    if (item?.type === 'chunk') {
      pending.push(...item.imports);
    }
  }
  // The files that hold a child's view. The loader never imports them.
  const views = new Set<string>();
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk' && item.moduleIds.some((id) => VIEW_CHUNK.test(id))) {
      views.add(item.fileName);
    }
  }
  // Every static import of an idlip chunk must already be loaded. The exceptions are the helpers
  // and templates modules, which the loader loads with the first chunk in the same round trip,
  // and a view reached from a chunk that can add a child in the browser: a list row, a condition
  // branch in a binding chunk, a `<Try>` region, or another view. The helpers and templates
  // modules themselves may import only what the loader holds.
  const errors: string[] = [];
  const checked = [...chunkFiles, ...sharedFiles];
  for (const file of checked) {
    const item = items[file];
    if (item?.type !== 'chunk') {
      continue;
    }
    const ids = [...item.moduleIds, item.facadeModuleId ?? ''];
    const addsChild = ids.some((id) => RENDER_CHUNK.test(id) || VIEW_CHUNK.test(id));
    for (const imported of item.imports) {
      if (
        !loaded.has(imported) &&
        !sharedFiles.includes(imported) &&
        !(addsChild && views.has(imported))
      ) {
        errors.push(`${file} imports ${imported}, which the loader does not import`);
      }
    }
  }
  if (errors.length > 0) {
    reporter.error(
      `idlip: a click would load a shared chunk. Import it from the loader, or copy the code into each chunk.\n${errors.join('\n')}`,
    );
  }
}

/**
 * Returns the file of a shared module (`idlip/helpers` or `idlip/templates`) in a client bundle.
 * It is `undefined` when no chunk imports it, or when one chunk alone does and holds it.
 */
function findSharedFile(bundle: Rolldown.OutputBundle, module: string): string | undefined {
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk' && !item.isEntry && item.moduleIds.includes(module)) {
      return item.fileName;
    }
  }
  return undefined;
}

/**
 * The bytes a shared template costs in the templates module and in each importing chunk, which
 * the saving from the removed copies must exceed: `export const t<hash> = ` and
 * `import { t<hash> as templateL0$ } from 'idlip/templates';`, about 100 B.
 */
const SHARE_COST = 100;

/**
 * Finds the templates to move to the shared templates module: the hash to the declaration. A
 * template moves when two or more files render it and the copies it removes outweigh `SHARE_COST`.
 * One file counts once, since its chunks (a child's view and list, a list and its bindings)
 * render the same rows and are loaded together. Two different declarations under one hash stay
 * in their chunks.
 */
function findSharedTemplates(results: readonly CompileResult[]): Map<string, string> {
  const files = new Map<string, number>();
  const inits = new Map<string, string>();
  const clashes = new Set<string>();
  for (const result of results) {
    const hashes = new Set<string>();
    for (const { client } of listCompiled(result)) {
      for (const module of client) {
        for (const { hash, init } of module.templates ?? []) {
          hashes.add(hash);
          if (inits.has(hash) && inits.get(hash) !== init) {
            clashes.add(hash);
          }
          inits.set(hash, init);
        }
      }
    }
    for (const hash of hashes) {
      files.set(hash, (files.get(hash) ?? 0) + 1);
    }
  }
  const found = new Map<string, string>();
  for (const [hash, count] of files) {
    const init = inits.get(hash)!;
    if (count > 1 && !clashes.has(hash) && (count - 1) * init.length > SHARE_COST) {
      found.set(hash, init);
    }
  }
  return found;
}

/** Reads the `fetch` of the default export of the server entry. */
function readFetch(module: unknown, entry: string): (request: Request) => unknown {
  const exported: unknown =
    typeof module === 'object' && module !== null ? Reflect.get(module, 'default') : undefined;
  const handler: unknown =
    typeof exported === 'object' && exported !== null ? Reflect.get(exported, 'fetch') : undefined;
  if (typeof handler !== 'function') {
    throw new TypeError(`${entry} has no default export { fetch(request) }`);
  }
  return (request): unknown => Reflect.apply(handler, exported, [request]) as unknown;
}

/** Makes the web request of a Node request. */
function toRequest(request: Connect.IncomingMessage): Request {
  const url = new URL(
    request.originalUrl ?? request.url ?? '/',
    `http://${request.headers.host ?? 'localhost'}`,
  );
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value);
    } else if (value !== undefined) {
      headers.set(name, value.join(', '));
    }
  }
  return new Request(url, { method: request.method, headers });
}

/**
 * Renders a page with the server entry, for `vite dev` without Nitro: calls the `fetch` of its
 * default export and sends the response.
 */
async function servePage(
  server: ViteDevServer,
  entry: string,
  request: Connect.IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const environment = server.environments.ssr;
  if (!isRunnableDevEnvironment(environment)) {
    throw new Error('idlip needs a runnable ssr environment to render pages in dev');
  }
  const module: unknown = await environment.runner.import(entry);
  const answer: unknown = await readFetch(module, entry)(toRequest(request));
  if (!(answer instanceof Response)) {
    throw new TypeError(`fetch(request) in ${entry} returned no Response`);
  }
  response.statusCode = answer.status;
  for (const [name, value] of answer.headers) {
    response.setHeader(name, value);
  }
  if (answer.body === null) {
    response.end();
  } else {
    // `pipeline` cancels the web stream when the client leaves, so the render stops its pending
    // work, and it ends the response when the stream fails, since an error here would crash `vite`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    pipeline(Readable.fromWeb(answer.body as NodeStream), response, () => {
      response.destroy();
    });
  }
}

/**
 * `idlip/vite`: compiles the `.tsx` modules, emits one client chunk per handler,
 * binding group and list, gives the server module the chunk URLs, and serves
 * server-rendered pages in `vite dev`.
 */
export function idlip(options: IdlipOptions = {}): Plugin[] {
  const patterns = typeof options.modules === 'string' ? [options.modules] : options.modules;
  const entry = options.entry;
  /** `build.outDir` of the user config, which holds the client and server folders. */
  let outDir = 'dist';
  let chunksFile = '';
  let envPrefixes: string[] = [];
  const scanCache: ScanCache = new Map();
  let compile = options.compile;
  let root = '';
  let base = '/';
  let isServe = false;
  /** True when the config has Nitro, which serves the pages, or the `server` option is off. */
  let standAside = options.server === false;
  /** Compiled modules by file, with the source they came from. */
  const cache = new Map<
    string,
    {
      source: string;
      key: string;
      rendered: readonly string[];
      result: CompileResult;
      shared: Map<string, string> | undefined;
    }
  >();
  /** Files already warned about, so each warns once. */
  const warned = new Set<string>();
  /** The components that another module renders as a child, by file, found on first use. */
  let children: Map<string, Set<string>> | undefined;
  /** Emitted chunk references of the client build, by chunk id. */
  const emitted = new Map<string, { id: string; reference: string }>();
  /** The chunk URL map of the client build in this process. */
  let built: ChunkUrls | undefined;
  /** The feature globals of the client build and their values, set once its modules compile. */
  let defines: Map<string, string> | undefined;
  /** The files of the client build, relative to its folder. */
  let buildFiles: string[] = [];
  /** The templates that more than one chunk of the client build renders, by hash. */
  let shared: Map<string, string> | undefined;
  /** The stylesheets that each module file reaches, for the client build's entries. */
  const styleEntries = new Map<string, string[]>();
  /** The dependencies of the app that publish components, found in `config`. */
  let packages: IdlipPackage[] = [];

  /** The module id of a file: the path from the root, or the package name and the path in it. */
  function getModuleId(file: string): string {
    const info = findPackage(packages, toPosix(file));
    if (info !== undefined) {
      return getPackageId(info, toPosix(file));
    }
    return `/${path.relative(root, file).split(path.sep).join('/')}`;
  }

  /** Fails when a client chunk reaches server-only code (`server-only.ts`). */
  async function checkChunk(
    context: Rolldown.PluginContext,
    file: string,
    module: string,
    chunk: string,
    code: string,
  ): Promise<void> {
    const host = {
      async resolve(specifier: string, importer: string): Promise<string | undefined> {
        const found = await context.resolve(specifier, importer, { skipSelf: true });
        return found?.external === false ? found.id : undefined;
      },
      read: readSource,
    };
    const label = getModuleId(file) + module.slice(file.length);
    await checkServerOnly(
      host,
      { file, chunk, code, label, prefixes: envPrefixes },
      scanCache,
      getModuleId,
    );
  }

  /** The file of a module id. */
  function getFile(id: string): string {
    return getPackageFile(packages, id) ?? path.join(root, id);
  }

  /** The URL that dev serves a chunk at: under the base, or `/@fs/` for a file of a package. */
  function toChunkUrl(id: string): string {
    if (id.startsWith('/')) {
      return `${base}${id.slice(1)}`;
    }
    const query = id.indexOf('?');
    const file = getFile(query < 0 ? id : id.slice(0, query));
    return `${base}@fs${file}${query < 0 ? '' : id.slice(query)}`;
  }

  /** The URL that dev serves a stylesheet at: under the base, or `/@fs/` outside the root. */
  function toStyleUrl(id: string): string {
    const relative = path.relative(root, id);
    const url = relative.startsWith('..')
      ? `${base}@fs${toPosix(id)}`
      : `${base}${toPosix(relative)}`;
    return encodeURI(url);
  }

  /**
   * Lists the stylesheets that a file's import graph reaches, in import order: the file's own
   * imports first, then those of each script it imports, outside `node_modules`. A child
   * component's file is a script of the graph, so a parent lists the stylesheets of its children.
   */
  async function findStyles(context: Rolldown.PluginContext, file: string): Promise<string[]> {
    const found = new Set<string>();
    const seen = new Set<string>();
    async function visit(current: string): Promise<void> {
      if (seen.has(current)) {
        return;
      }
      seen.add(current);
      let source: string;
      try {
        source = readFileSync(current, 'utf8');
      } catch {
        return;
      }
      for (const specifier of listImports(current, source)) {
        // oxlint-disable-next-line no-await-in-loop
        const target = await context.resolve(specifier, current);
        if (target === null || Boolean(target.external) || target.id.startsWith('\0')) {
          continue;
        }
        const id = cleanId(target.id);
        if (isStyle(id)) {
          if (!STYLE_QUERY.test(target.id)) {
            found.add(id);
          }
        } else if (isScript(id, findPackage(packages, id) !== undefined)) {
          // oxlint-disable-next-line no-await-in-loop
          await visit(id);
        }
      }
    }
    await visit(file);
    return [...found];
  }

  /**
   * Writes the stylesheet URLs of each module file into the chunk map, from the bundle's entries
   * for them, and returns the files of those entries. A chunk's stylesheets are its own and those
   * of the chunks it imports, the imported ones first, as Vite orders them.
   */
  function readStyleFiles(
    bundle: Rolldown.OutputBundle,
    prefix: string,
    urls: Record<string, string>,
  ): Set<string> {
    const items: Partial<Rolldown.OutputBundle> = bundle;
    const entries = new Set<string>();
    for (const item of Object.values(bundle)) {
      if (item.type === 'chunk' && item.facadeModuleId?.startsWith(STYLES_ID) === true) {
        entries.add(item.fileName);
        const file = item.facadeModuleId.slice(STYLES_ID.length);
        // The import order of the sources, which the links must follow: the first source that a
        // sheet holds sets its place, whatever order the bundler wrote the chunks in.
        const order = (styleEntries.get(file) ?? []).map((id) => cleanId(id));
        const sheets = new Map<string, number>();
        const visited = new Set<string>();
        function visit(name: string): void {
          const chunk = items[name];
          if (chunk?.type !== 'chunk' || visited.has(name)) {
            return;
          }
          visited.add(name);
          for (const imported of chunk.imports) {
            visit(imported);
          }
          let place = order.length;
          for (const id of chunk.moduleIds) {
            const index = order.indexOf(cleanId(id));
            if (index >= 0 && index < place) {
              place = index;
            }
          }
          for (const sheet of chunk.viteMetadata?.importedCss ?? []) {
            sheets.set(sheet, Math.min(place, sheets.get(sheet) ?? place));
          }
        }
        visit(item.fileName);
        const list: string[] = [];
        for (const [sheet] of [...sheets].toSorted((a, b) => a[1] - b[1])) {
          list.push(encodeURI(`${prefix}${sheet}`));
        }
        urls[`${STYLES_PREFIX}${getModuleId(file)}`] = list.join(' ');
      }
    }
    // Nothing loads the entries: the stylesheets are what they were for. A chunk that only the
    // entries import (the class object of a CSS Module that two entries share) goes with them.
    const dropped = [...entries];
    for (const file of dropped) {
      const item = items[file];
      Reflect.deleteProperty(bundle, file);
      if (item?.type !== 'chunk') {
        continue;
      }
      for (const imported of item.imports) {
        const other = items[imported];
        if (other?.type !== 'chunk' || other.isEntry || entries.has(imported)) {
          continue;
        }
        let used = false;
        for (const rest of Object.values(bundle)) {
          used ||= rest.type === 'chunk' && rest.imports.includes(imported);
        }
        if (!used) {
          entries.add(imported);
          dropped.push(imported);
        }
      }
    }
    return entries;
  }

  /**
   * Replaces each default import of a CSS Module in the code of a chunk with the module's class
   * object, written in the chunk. Why: an import of a separate module makes the bundler move the
   * chunk's code into a common chunk, and a click would load a stub and then that chunk.
   */
  async function inlineNames(
    context: Rolldown.PluginContext,
    code: string,
    file: string,
  ): Promise<string> {
    let result = code;
    for (const match of code.matchAll(DEFAULT_IMPORT)) {
      const [text, local, , specifier] = match;
      if (!isStyleModule(specifier)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop
      const target = await context.resolve(specifier, file);
      if (target === null || Boolean(target.external)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop
      const info = await context.load({ id: target.id });
      if (info.code === null) {
        return context.error(`idlip: ${target.id} has no class names`);
      }
      // The module's own `export const` lines and its default export become one local object.
      const body = info.code
        .replace(/^export default /m, 'return ')
        .replaceAll(/^export (const|let|var) /gm, '$1 ');
      if (/^export /m.test(body)) {
        return context.error(`idlip: ${target.id} has an export that a chunk cannot inline`);
      }
      result = result.replace(text, `const ${local} = (() => {\n${body}\n})();`);
    }
    return result;
  }

  /** Whether each `.tsx` file holds a component, with the source that was read. */
  const components = new Map<string, { source: string; found: boolean }>();

  /** Module ids of the child specifiers that the last scan resolved, by importer and specifier. */
  const resolved = new Map<string, string>();

  /** Names the module id of a specifier, as the scan of `findChildren` resolved it. */
  function resolveModule(specifier: string, importer: string): string {
    const known = resolved.get(`${importer}\0${specifier}`);
    if (known !== undefined) {
      return known;
    }
    if (!specifier.startsWith('.')) {
      return specifier;
    }
    return getModuleId(path.resolve(path.dirname(getFile(importer)), specifier));
  }

  /**
   * Finds the components that another module renders as a child, through Vite's resolver, so an
   * alias or a bare specifier works: the imported names (`default`, or the name of a named
   * component) by file. The result stays until a file of the app changes.
   */
  async function findChildren(context: Rolldown.PluginContext): Promise<Map<string, Set<string>>> {
    if (children !== undefined) {
      return children;
    }
    const found = new Map<string, Set<string>>();
    resolved.clear();
    for (const file of findModules()) {
      const importer = getModuleId(file);
      for (const child of compiler.listChildImports(readFileSync(file, 'utf8'), importer)) {
        const specifier = child.source;
        // oxlint-disable-next-line no-await-in-loop
        const target = await context.resolve(specifier, file);
        const id = target?.id.split('?')[0];
        if (id === undefined || !MODULE_FILE.test(id)) {
          continue;
        }
        // A `.tsx` file that is not an idlip module (the globs miss it, or it holds no component)
        // cannot be rendered as a component.
        if (!isModule(id)) {
          return context.error(
            `${importer} renders a component from ${getModuleId(id)}, which the idlip plugin does not compile. ` +
              `Add the file to the \`modules\` option of idlip(), for example \`modules: ['src/**/*.tsx']\`.`,
          );
        }
        const names = found.get(id) ?? new Set<string>();
        names.add(child.imported);
        found.set(id, names);
        resolved.set(`${importer}\0${specifier}`, getModuleId(id));
      }
    }
    children = found;
    return found;
  }

  /** The components of a file that other modules render, sorted: `default` and named ones. */
  function listRendered(file: string): string[] {
    return [...(children?.get(file) ?? [])].toSorted();
  }

  function compileFile(
    reporter: Reporter,
    file: string,
    code?: string,
    known?: readonly string[],
  ): CompileResult {
    const source = code ?? readFileSync(file, 'utf8');
    // A component that is also a root takes the child output, which only adds the view chunk.
    const rendered = known ?? listRendered(file);
    const key = rendered.join(',');
    const cached = cache.get(file);
    if (cached?.source === source && cached.key === key && cached.shared === shared) {
      return cached.result;
    }
    compile ??= getDefaultCompile();
    const named: string[] = [];
    for (const name of rendered) {
      if (name !== 'default') {
        named.push(name);
      }
    }
    const result = compile(source, getModuleId(file), {
      child: rendered.includes('default'),
      ...(named.length === 0 ? {} : { children: named }),
      resolve: resolveModule,
      ...(shared === undefined ? {} : { shared: new Set(shared.keys()) }),
    });
    reportDiagnostics(reporter, getModuleId(file), source, result.diagnostics);
    cache.set(file, { source, key, rendered, result, shared });
    return result;
  }

  /**
   * The idlip modules: the files the `modules` globs match that hold a function component, as
   * posix paths. Found on first use and again after a `.tsx` change.
   */
  let moduleFiles: string[] | undefined;
  let moduleSet = new Set<string>();

  function findModules(): string[] {
    if (moduleFiles !== undefined) {
      return moduleFiles;
    }
    const files: string[] = [];
    for (const name of globSync(patterns ?? DEFAULT_MODULES, {
      cwd: root,
      exclude: ['**/node_modules/**'],
    })) {
      const file = toPosix(path.resolve(root, name));
      // A `.tsx` file with no component, such as an entry or a helper, is left to Vite.
      if (MODULE_FILE.test(file) && hasComponent(file, readFileSync(file, 'utf8'))) {
        files.push(file);
      }
    }
    for (const info of packages) {
      for (const file of listPackageFiles(info)) {
        if (hasComponent(file, readFileSync(file, 'utf8'))) {
          files.push(file);
        }
      }
    }
    moduleFiles = files.toSorted();
    moduleSet = new Set(moduleFiles);
    return moduleFiles;
  }

  /** Whether the plugin compiles the file: a `.tsx` file with a component that a glob matches. */
  function isModule(file: string): boolean {
    findModules();
    return moduleSet.has(toPosix(file));
  }

  /** Whether the source declares a function component. The answer is kept per file and source. */
  function hasComponent(file: string, source: string): boolean {
    const known = components.get(file);
    if (known?.source === source) {
      return known.found;
    }
    const found = compiler.analyze(getModuleId(file), source).components.length > 0;
    components.set(file, { source, found });
    return found;
  }

  function readBuilt(): ChunkUrls {
    if (built !== undefined) {
      return built;
    }
    const file = chunksFile;
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`idlip: build the client before the server. ${file} is missing.`, {
        cause: error,
      });
    }
    if (!isChunkUrls(value)) {
      throw new Error(`idlip: ${file} is not a chunk URL map`);
    }
    built = value;
    return value;
  }

  /**
   * Returns the URLs of a module's chunks: the built files in a build, the ids
   * under the base in dev.
   */
  function getChunkUrls(
    result: CompileResult,
    file: string,
    devStyles: readonly string[],
  ): ChunkUrls | undefined {
    const all = isServe ? undefined : readBuilt();
    const urls: Record<string, string> = {};
    for (const { manifest } of listCompiled(result)) {
      for (const chunk of listChunks(manifest)) {
        const id = getChunkId(manifest.module, chunk);
        if (all === undefined) {
          urls[id] = toChunkUrl(id);
        } else if (Object.hasOwn(all, id)) {
          urls[id] = all[id];
        } else {
          throw new Error(`idlip: the client build has no chunk ${id}`);
        }
      }
    }
    // The server writes the build id on the state script and drops it from the chunk map. The
    // helpers URL stays in the map, for the loader.
    for (const key of [BUILD_KEY, HELPERS_KEY, TEMPLATES_KEY, LOADER_KEY]) {
      if (all !== undefined && Object.hasOwn(all, key)) {
        urls[key] = all[key];
      }
    }
    // The page's loader script: the built file, or the dev loader under the base.
    if (all === undefined) {
      urls[LOADER_KEY] = `${base}${DEV_LOADER_URL.slice(1)}`;
    }
    // The stylesheets of the module's import graph. Dev links the files Vite serves.
    const key = `${STYLES_PREFIX}${getModuleId(file)}`;
    let styles = '';
    if (all === undefined) {
      styles = devStyles.map(toStyleUrl).join(' ');
    } else if (Object.hasOwn(all, key)) {
      styles = all[key];
    }
    if (styles !== '') {
      urls[STYLES_KEY] = styles;
    }
    return urls;
  }

  const main: Plugin = {
    name: 'idlip',
    // Compile the source before Vite's TypeScript and JSX transform.
    enforce: 'pre',
    // One instance for both environments, so the ssr build reads the client
    // build's chunk URLs from memory.
    sharedDuringBuild: true,

    config(user) {
      outDir = user.build?.outDir ?? 'dist';
      // A package with an unknown format fails the start.
      packages = readPackages(path.resolve(user.root ?? process.cwd()));
      return createConfig(user, options, packages);
    },

    configResolved(config) {
      // The real path, since Vite names modules by it and a link would not match.
      root = realpathSync(config.root);
      // The real root may differ from the configured one (a link), and only then reads again.
      if (root !== path.resolve(config.root)) {
        packages = readPackages(root);
      }
      base = config.base;
      isServe = config.command === 'serve';
      standAside ||= config.plugins.some((plugin) => plugin.name === NITRO_PLUGIN);
      chunksFile = path.resolve(root, outDir, CHUNKS_FILE);
      envPrefixes = [config.envPrefix ?? 'VITE_'].flat();
    },

    async buildApp(builder) {
      // The server build needs the client build's chunk URLs.
      const environments: Partial<Record<string, BuildEnvironment>> = builder.environments;
      for (const environment of [environments.client, environments.ssr]) {
        if (environment !== undefined && !environment.isBuilt) {
          await builder.build(environment);
        }
      }
    },

    async buildStart() {
      moduleFiles = undefined;
      // No module imports a chunk, since the loader takes chunk URLs from the
      // page. So each chunk is an entry of its own.
      if (isServe || this.environment.name !== 'client') {
        return;
      }
      emitted.clear();
      shared = undefined;
      built = undefined;
      children = undefined;
      await findChildren(this);
      let results: CompileResult[] = [];
      for (const file of findModules()) {
        results.push(compileFile(this, file));
      }
      // A template that more than one file renders moves to the shared templates module, so its
      // markup is downloaded and parsed once. The chunks compile again to import it.
      shared = findSharedTemplates(results);
      if (shared.size > 0) {
        results = [];
        for (const file of findModules()) {
          results.push(compileFile(this, file));
        }
      } else {
        shared = undefined;
      }
      for (const [index, file] of findModules().entries()) {
        const result = results[index];
        // A named component adds its name: `widgets.Counter.handler.add.js`.
        const info = findPackage(packages, file);
        // A package prefixes its files, so two packages with a `button.tsx` emit different names.
        const stem =
          info === undefined
            ? path.basename(file, '.tsx')
            : `${getPackageSlug(info)}.${path.basename(file, '.tsx')}`;
        for (const { manifest } of listCompiled(result)) {
          const component = splitModule(manifest.module).name;
          const local = component === undefined ? file : `${file}#${component}`;
          const name = component === undefined ? stem : `${stem}.${component}`;
          for (const chunk of listChunks(manifest)) {
            const reference = this.emitFile({
              type: 'chunk',
              id: getChunkId(local, chunk),
              name: `${name}.${getChunkFile(chunk).slice(0, -'.js'.length)}`,
              preserveSignature: 'exports-only',
            });
            emitted.set(getChunkId(manifest.module, chunk), {
              id: getChunkId(local, chunk),
              reference,
            });
          }
        }
      }
      // One entry per module file imports the stylesheets of its import graph, so the bundler
      // writes them. No chunk imports a stylesheet, since the page links them.
      styleEntries.clear();
      for (const file of findModules()) {
        // oxlint-disable-next-line no-await-in-loop
        const styles = await findStyles(this, file);
        if (styles.length > 0) {
          styleEntries.set(file, styles);
          this.emitFile({
            type: 'chunk',
            id: `${STYLES_ID}${file}`,
            name: `${path.basename(file, '.tsx')}.styles`,
            preserveSignature: 'strict',
          });
        }
      }
      // Every module is compiled before the loader is bundled, so the loader sees the defines.
      defines = getDefines(getFeatures(results), options.skew !== false);
    },

    async resolveId(source, importer) {
      if (source.startsWith(STYLES_ID)) {
        return source;
      }
      // A chunk gets the class names of a CSS Module as a module of its own. The stylesheet
      // itself is linked by the page.
      if (
        importer !== undefined &&
        !isServe &&
        this.environment.name === 'client' &&
        isStyleModule(source) &&
        parseChunkId(importer) !== undefined
      ) {
        const target = await this.resolve(source, importer, { skipSelf: true });
        if (target !== null && !target.external) {
          return `${NAMES_ID}${encodeURIComponent(target.id)}@${encodeURIComponent(importer)}`;
        }
      }
      // A chunk imports the view of a package component by its module id, which names no folder.
      const chunk = parseChunkId(source);
      if (chunk !== undefined && !source.startsWith('/')) {
        const file = getPackageFile(packages, chunk.file);
        if (file !== undefined) {
          return this.resolve(`${file}${source.slice(chunk.file.length)}`, importer, {
            skipSelf: true,
          });
        }
      }
      if (source === HELPERS_MODULE) {
        return HELPERS_ID;
      }
      if (source === TEMPLATES_MODULE) {
        return TEMPLATES_ID;
      }
      return source === DEV_LOADER ? DEV_LOADER : undefined;
    },

    async load(id) {
      if (id.startsWith(STYLES_ID)) {
        const styles = styleEntries.get(id.slice(STYLES_ID.length)) ?? [];
        let code = '';
        for (const [index, style] of styles.entries()) {
          // A CSS Module has no side effect for the bundler, so the entry exports it to keep it.
          code += isStyleModule(style)
            ? `export { default as s${index} } from ${JSON.stringify(style)};\n`
            : `import ${JSON.stringify(style)};\n`;
        }
        return { code, moduleType: 'js' };
      }
      if (id.startsWith(NAMES_ID)) {
        const real = decodeURIComponent(id.slice(NAMES_ID.length, id.lastIndexOf('@')));
        const info = await this.load({ id: real });
        if (info.code === null) {
          return this.error(`idlip: ${real} has no class names`);
        }
        return { code: info.code, moduleType: 'js' };
      }
      if (id === DEV_LOADER) {
        // The dev server's client rides with the loader, so a page needs no markup for it.
        return { code: "import '/@vite/client';\nimport 'idlip/client';\n", moduleType: 'js' };
      }
      if (id === HELPERS_ID) {
        return { code: printHelpersModule(), moduleType: 'js' };
      }
      if (id === TEMPLATES_ID) {
        return { code: printTemplatesModule(shared ?? new Map()), moduleType: 'js' };
      }
      const parsed = parseChunkId(id);
      if (parsed === undefined) {
        return undefined;
      }
      this.addWatchFile(parsed.file);
      await findChildren(this);
      const result = compileFile(this, parsed.file);
      // The chunk id names the component: none for the default export, `Name.` for another.
      const name = splitModule(parsed.module).name;
      for (const { manifest, client } of listCompiled(result)) {
        if (splitModule(manifest.module).name !== name) {
          continue;
        }
        for (const module of client) {
          if (module.chunk === parsed.chunk) {
            if (this.environment.name === 'client') {
              await checkChunk(this, parsed.file, parsed.module, parsed.chunk, module.code);
            }
            const code =
              isServe || this.environment.name !== 'client'
                ? module.code
                : await inlineNames(this, module.code, parsed.file);
            return { code, moduleType: 'js' };
          }
        }
      }
      const owner = name === undefined ? '' : ` (component ${name})`;
      return this.error(`${getModuleId(parsed.file)}${owner} has no chunk ${parsed.chunk}`);
    },

    transform: {
      filter: { id: MODULE_FILE },
      async handler(code, id) {
        // Any other `.tsx` file is plain TSX, left to Vite.
        if (!isModule(id)) {
          if (hasComponent(id, code) && !warned.has(id)) {
            // A component the plugin does not compile would run as plain JSX.
            warned.add(id);
            this.warn(
              `${getModuleId(id)} holds a component but is outside the \`modules\` option of idlip(), so the plugin does not compile it.`,
            );
          }
          return undefined;
        }
        // The client never imports a module: the loader takes chunk URLs from
        // the page. Anywhere else the module is its compiled server module.
        if (this.environment.config.consumer === 'client') {
          return this.error(
            `${getModuleId(id)} is server code. The client loads its chunks by URL.`,
          );
        }
        await findChildren(this);
        const result = compileFile(this, id, code);
        const urls = getChunkUrls(result, id, isServe ? await findStyles(this, id) : []);
        return {
          code: urls === undefined ? result.server : replaceChunkUrls(result.server, urls),
          moduleType: 'js',
        };
      },
    },

    generateBundle(_output, bundle) {
      if (this.environment.name !== 'client') {
        return;
      }
      const urls: Record<string, string> = {};
      const files = new Set<string>();
      // Chunks match by the id of their module, since two modules of the same file name emit
      // chunks of the same name.
      const fileByModule = new Map<string, string>();
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.facadeModuleId !== null) {
          fileByModule.set(item.facadeModuleId, item.fileName);
        }
      }
      for (const [key, { id }] of emitted) {
        const file = fileByModule.get(id);
        if (file === undefined) {
          this.error(`The client build has no chunk for ${key}`);
        }
        files.add(file);
        urls[key] = `${base}${file}`;
      }
      const helpersFile = findSharedFile(bundle, HELPERS_ID);
      if (helpersFile !== undefined) {
        urls[HELPERS_KEY] = `${base}${helpersFile}`;
      }
      // The bundler may put the templates in the helpers file, which the loader loads already.
      const templatesFile = findSharedFile(bundle, TEMPLATES_ID);
      if (templatesFile !== undefined && templatesFile !== helpersFile) {
        urls[TEMPLATES_KEY] = `${base}${templatesFile}`;
      }
      const sharedFiles: string[] = [];
      for (const file of [helpersFile, templatesFile]) {
        if (file !== undefined) {
          sharedFiles.push(file);
        }
      }
      const styleFiles = readStyleFiles(bundle, base, urls);
      checkChunkImports(this, bundle, files, sharedFiles, styleFiles);
      // The page names the loader by this URL, so the server needs no read of the client manifest.
      urls[LOADER_KEY] = `${base}${findLoaderFile(bundle, new Set([...files, ...styleFiles]))}`;
      if (options.skew !== false) {
        const id = getBuildId(Object.keys(bundle));
        urls[BUILD_KEY] = id;
        // The loader imports this module from its own folder, to learn the server's build.
        const buildFile = path.posix.join(
          path.posix.dirname(findLoaderFile(bundle, new Set([...files, ...styleFiles]))),
          BUILD_FILE,
        );
        this.emitFile({ type: 'asset', fileName: buildFile, source: getBuildSource(id) });
        buildFiles = [...Object.keys(bundle), buildFile];
      }
      built = urls;
    },

    writeBundle(output) {
      if (this.environment.name !== 'client' || built === undefined) {
        return;
      }
      if (options.skew !== false) {
        keepBuilds(path.resolve(root, outDir, BUILDS_FILE), output.dir ?? '', {
          id: built[BUILD_KEY],
          files: buildFiles,
        });
      }
      mkdirSync(path.dirname(chunksFile), { recursive: true });
      writeFileSync(chunksFile, JSON.stringify(built, null, 2));
    },

    watchChange(file) {
      if (MODULE_FILE.test(file)) {
        moduleFiles = undefined;
        children = undefined;
      }
    },

    async hotUpdate({ file, modules, timestamp, read }) {
      if (MODULE_FILE.test(file)) {
        moduleFiles = undefined;
      }
      // A module that was compiled stays one when an edit breaks it, so the page reloads.
      if (!isModule(file) && !cache.has(file)) {
        return undefined;
      }
      // The edit may add or drop a child import, in any environment.
      children = undefined;
      if (this.environment.config.consumer !== 'client') {
        return undefined;
      }
      // The edit is a chunk swap when the markup and the manifest stay, and a remount otherwise.
      const before = cache.get(file)?.result;
      let message: ReturnType<typeof classifyEdit>;
      let reload: boolean;
      try {
        const after = compileFile(
          {
            warn() {},
            error(text) {
              throw new Error(text);
            },
          },
          file,
          await read(),
          cache.get(file)?.rendered,
        );
        message = classifyEdit(before, after, base, timestamp, toChunkUrl);
        reload = changesShell(before, after);
      } catch {
        // A module that does not compile: the page loads again and shows the server's error.
        this.environment.hot.send({ type: 'full-reload' });
        return [];
      }
      // A remount swaps `<body>` only, so an edit of `<html>` or of the head loads the page again.
      if (reload && message?.kind === 'remount') {
        this.environment.hot.send({ type: 'full-reload' });
        return [];
      }
      // Vite lists every chunk of the file that the client loaded.
      const graph = this.environment.moduleGraph;
      const invalidated = new Set<(typeof modules)[number]>();
      for (const module of modules) {
        graph.invalidateModule(module, invalidated, timestamp, true);
      }
      if (message !== undefined) {
        this.environment.hot.send({ type: 'custom', event: HOT_EVENT, data: message });
      }
      return [];
    },

    configureServer(server) {
      // A linked package may sit outside the project: serve it, and watch its source for edits.
      for (const info of packages) {
        if (!info.dir.includes('/node_modules/')) {
          server.config.server.fs.allow.push(info.dir);
          server.watcher.add(info.src);
        }
      }
      // The browser keys modules by URL. A page's `/@id/idlip/client` served as it is would be
      // a second copy of the loader next to the URL that chunks import, so it gets the proxy.
      server.middlewares.use((request, _response, next) => {
        if (request.url === DEV_LOADER_URL) {
          request.url = `/@id/__x00__${DEV_LOADER.slice(1)}`;
        }
        next();
      });
      // Nitro renders the pages in its own worker, so the plugin leaves the route to it.
      if (entry === undefined || standAside) {
        return;
      }
      server.middlewares.use((request, response, next) => {
        const accept = request.headers.accept ?? '';
        if (request.method !== 'GET' || !accept.includes('text/html')) {
          next();
          return;
        }
        servePage(server, entry, request, response).catch((error: unknown) => {
          if (error instanceof Error) {
            server.ssrFixStacktrace(error);
          }
          next(error);
        });
      });
    },
  };

  // The loader drops the code of features that no module uses.
  const features: Plugin = {
    name: 'idlip:features',
    enforce: 'pre',
    sharedDuringBuild: true,
    transform: {
      filter: { code: { include: '__IDLIP_HAS_' } },
      handler(code) {
        if (defines === undefined || this.environment.name !== 'client') {
          return undefined;
        }
        return replaceFeatures(code, defines);
      },
    },
  };

  return [main, features];
}
