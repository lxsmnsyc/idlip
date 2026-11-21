import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
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
import type { ChunkUrls, Compile, CompileDiagnostic, CompileResult } from '../core/format.ts';
import { getChunkFile, getChunkId } from '../core/format.ts';
import { findDroppedFeatures, getDefines, getFeatures, replaceFeatures } from './features.ts';
import { isChunkUrls, listChunks, parseChunkId, replaceChunkUrls } from './chunks.ts';

const MODULE_FILE = /\.idlip\.tsx$/;
/**
 * The chunk URL map of the client build, under `build.outDir` and outside the served client
 * folder, for a server build in another process.
 */
const CHUNKS_FILE = '.idlip/chunks.json';

export interface IdlipOptions {
  /** Globs of the idlip modules, relative to the root. Default: `src/**\/*.idlip.tsx`. */
  modules?: string | readonly string[];
  /**
   * The server entry `vite dev` renders pages with, such as `/src/entry-server.ts`. It
   * exports `render(url)`, which returns the page HTML. It is also the input of the ssr build
   * when the config sets none.
   */
  entry?: string;
  /**
   * The input of the client build: the loader. Default: `idlip/client`. Every module an idlip
   * chunk imports must be in its static graph, so a click loads no shared chunk.
   */
  client?: string;
  /** The compiler. Default: `compile` from `idlip/compiler`. */
  compile?: Compile;
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
function getDefaultCompile(): Compile {
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
): NonNullable<EnvironmentOptions['build']> {
  return {
    ...(user?.build?.outDir === undefined ? { outDir } : {}),
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
function createConfig(user: UserConfig, options: IdlipOptions): UserConfig {
  const environments: Partial<Record<string, EnvironmentOptions>> = user.environments ?? {};
  const outDir = user.build?.outDir ?? 'dist';
  return {
    builder: {},
    environments: {
      client: {
        build: createBuild(
          environments.client,
          path.join(outDir, 'client'),
          options.client ?? 'idlip/client',
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
): void {
  const items: Partial<Rolldown.OutputBundle> = bundle;
  // Walk the static imports from every entry that is not an idlip chunk.
  const loaded = new Set<string>();
  const pending: string[] = [];
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk' && item.isEntry && !chunkFiles.has(item.fileName)) {
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
  // Every static import of an idlip chunk must already be loaded.
  const errors: string[] = [];
  for (const file of chunkFiles) {
    const item = items[file];
    if (item?.type !== 'chunk') {
      continue;
    }
    for (const imported of item.imports) {
      if (!loaded.has(imported)) {
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
 * Renders a page with the server entry, for `vite dev`.
 */
async function servePage(
  server: ViteDevServer,
  entry: string,
  request: Connect.IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = request.originalUrl ?? request.url ?? '/';
  const environment = server.environments.ssr;
  if (!isRunnableDevEnvironment(environment)) {
    throw new Error('idlip needs a runnable ssr environment to render pages in dev');
  }
  const module: unknown = await environment.runner.import(entry);
  const render: unknown =
    typeof module === 'object' && module !== null ? Reflect.get(module, 'render') : undefined;
  if (typeof render !== 'function') {
    throw new TypeError(`${entry} exports no render(url)`);
  }
  const html: unknown = await Reflect.apply(render, undefined, [url]);
  if (typeof html !== 'string') {
    throw new TypeError(`render(url) in ${entry} returned no string`);
  }
  const page = await server.transformIndexHtml(url, html, request.originalUrl);
  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(page);
}

/**
 * `idlip/vite`: compiles `*.idlip.tsx` modules, emits one client chunk per handler,
 * binding group and list, gives the server module the chunk URLs, and serves
 * server-rendered pages in `vite dev`.
 */
export function idlip(options: IdlipOptions = {}): Plugin[] {
  const patterns = typeof options.modules === 'string' ? [options.modules] : options.modules;
  const entry = options.entry;
  /** `build.outDir` of the user config, which holds the client and server folders. */
  let outDir = 'dist';
  let chunksFile = '';
  let compile = options.compile;
  let root = '';
  let base = '/';
  let isServe = false;
  /** Compiled modules by file, with the source they came from. */
  const cache = new Map<string, { source: string; result: CompileResult }>();
  /** Emitted chunk references of the client build, by chunk id. */
  const emitted = new Map<string, string>();
  /** The chunk URL map of the client build in this process. */
  let built: ChunkUrls | undefined;
  /** The feature globals of the client build and their values, set once its modules compile. */
  let defines: Map<string, string> | undefined;

  function getModuleId(file: string): string {
    return `/${path.relative(root, file).split(path.sep).join('/')}`;
  }

  function compileFile(reporter: Reporter, file: string, code?: string): CompileResult {
    const source = code ?? readFileSync(file, 'utf8');
    const cached = cache.get(file);
    if (cached?.source === source) {
      return cached.result;
    }
    compile ??= getDefaultCompile();
    const result = compile(source, getModuleId(file));
    reportDiagnostics(reporter, getModuleId(file), source, result.diagnostics);
    cache.set(file, { source, result });
    return result;
  }

  function findModules(): string[] {
    const files: string[] = [];
    for (const name of globSync(patterns ?? ['src/**/*.idlip.tsx'], {
      cwd: root,
      exclude: ['**/node_modules/**'],
    })) {
      files.push(path.resolve(root, name));
    }
    return files.toSorted();
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
  function getChunkUrls(result: CompileResult): ChunkUrls | undefined {
    if (isServe && base === '/') {
      return undefined;
    }
    const all = isServe ? undefined : readBuilt();
    const urls: Record<string, string> = {};
    for (const chunk of listChunks(result.manifest)) {
      const id = getChunkId(result.manifest.module, chunk);
      if (all === undefined) {
        urls[id] = `${base}${id.slice(1)}`;
      } else if (Object.hasOwn(all, id)) {
        urls[id] = all[id];
      } else {
        throw new Error(`idlip: the client build has no chunk ${id}`);
      }
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
      return createConfig(user, options);
    },

    configResolved(config) {
      root = config.root;
      base = config.base;
      isServe = config.command === 'serve';
      chunksFile = path.resolve(root, outDir, CHUNKS_FILE);
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

    buildStart() {
      // No module imports a chunk, since the loader takes chunk URLs from the
      // page. So each chunk is an entry of its own.
      if (isServe || this.environment.name !== 'client') {
        return;
      }
      emitted.clear();
      built = undefined;
      const results: CompileResult[] = [];
      for (const file of findModules()) {
        const result = compileFile(this, file);
        results.push(result);
        const name = path.basename(file, '.idlip.tsx');
        for (const chunk of listChunks(result.manifest)) {
          const reference = this.emitFile({
            type: 'chunk',
            id: getChunkId(file, chunk),
            name: `${name}.${getChunkFile(chunk).slice(0, -'.js'.length)}`,
            preserveSignature: 'exports-only',
          });
          emitted.set(getChunkId(result.manifest.module, chunk), reference);
        }
      }
      // Every module is compiled before the loader is bundled, so the loader sees the defines.
      defines = getDefines(getFeatures(results));
    },

    load(id) {
      const parsed = parseChunkId(id);
      if (parsed === undefined) {
        return undefined;
      }
      this.addWatchFile(parsed.file);
      const result = compileFile(this, parsed.file);
      for (const module of result.client) {
        if (module.chunk === parsed.chunk) {
          return { code: module.code, moduleType: 'js' };
        }
      }
      return this.error(`${getModuleId(parsed.file)} has no chunk ${parsed.chunk}`);
    },

    transform: {
      filter: { id: MODULE_FILE },
      handler(code, id) {
        // The client never imports a module: the loader takes chunk URLs from
        // the page. Anywhere else the module is its compiled server module.
        if (this.environment.config.consumer === 'client') {
          return this.error(
            `${getModuleId(id)} is server code. The client loads its chunks by URL.`,
          );
        }
        const result = compileFile(this, id, code);
        // A module outside the `modules` globs was not counted, so the client build may have
        // dropped the loader code it needs.
        if (defines !== undefined) {
          for (const name of findDroppedFeatures(result, defines)) {
            this.error(
              `${getModuleId(id)} uses ${name}, which the client build dropped because no module of \`modules\` uses it. Add the module to \`modules\`.`,
            );
          }
        }
        const urls = getChunkUrls(result);
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
      for (const [id, reference] of emitted) {
        const file = this.getFileName(reference);
        files.add(file);
        urls[id] = `${base}${file}`;
      }
      checkChunkImports(this, bundle, files);
      built = urls;
    },

    writeBundle() {
      if (this.environment.name !== 'client' || built === undefined) {
        return;
      }
      mkdirSync(path.dirname(chunksFile), { recursive: true });
      writeFileSync(chunksFile, JSON.stringify(built, null, 2));
    },

    hotUpdate({ file, modules, timestamp }) {
      if (!MODULE_FILE.test(file) || this.environment.config.consumer !== 'client') {
        return undefined;
      }
      // The page's DOM came from the old view, so a new chunk cannot patch it.
      // Vite lists every chunk of the file that the client loaded.
      const graph = this.environment.moduleGraph;
      const invalidated = new Set<(typeof modules)[number]>();
      for (const module of modules) {
        graph.invalidateModule(module, invalidated, timestamp, true);
      }
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    },

    configureServer(server) {
      if (entry === undefined) {
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
