import { globSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
import type { CompileOptions } from '../compiler/index.ts';
import type { ChunkUrls, Compile, CompileDiagnostic, CompileResult } from '../core/format.ts';
import { getChunkFile, getChunkId } from '../core/format.ts';
import { getDefines, getFeatures, replaceFeatures } from './features.ts';
import { HOT_EVENT, classifyEdit } from './hot.ts';
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

const MODULE_FILE = /\.tsx$/;

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
/**
 * The chunk URL map of the client build, under `build.outDir` and outside the served client
 * folder, for a server build in another process.
 */
const CHUNKS_FILE = '.idlip/chunks.json';
/** The default `modules` globs. */
const DEFAULT_MODULES = ['src/**/*.tsx'];
/** The end of the id of a child's view chunk. */
const VIEW_SUFFIX = '?idlip-view&lang.js';
/** The id of a list chunk, whose item template renders a child with its view. */
const LIST_CHUNK = /\?idlip-list=[^&]*&lang\.js$/;

export interface IdlipOptions {
  /** Globs of the idlip modules, relative to the root. Default: `src/**\/*.tsx`. */
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
  // The files that hold a child's view. The loader never imports them.
  const views = new Set<string>();
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk' && item.moduleIds.some((id) => id.endsWith(VIEW_SUFFIX))) {
      views.add(item.fileName);
    }
  }
  // Every static import of an idlip chunk must already be loaded. The one exception is a view
  // reached from a list chunk, which loads when rows are added, or from another view file.
  const errors: string[] = [];
  for (const file of chunkFiles) {
    const item = items[file];
    if (item?.type !== 'chunk') {
      continue;
    }
    const ids = [...item.moduleIds, item.facadeModuleId ?? ''];
    const fromList = ids.some((id) => LIST_CHUNK.test(id) || id.endsWith(VIEW_SUFFIX));
    for (const imported of item.imports) {
      if (!loaded.has(imported) && !(fromList && views.has(imported))) {
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
  let compile = options.compile;
  let root = '';
  let base = '/';
  let isServe = false;
  /** Compiled modules by file, with the source they came from. */
  const cache = new Map<string, { source: string; child: boolean; result: CompileResult }>();
  /** Files already warned about, so each warns once. */
  const warned = new Set<string>();
  /** The files that another module renders as a child, found on first use. */
  let children: Set<string> | undefined;
  /** Emitted chunk references of the client build, by chunk id. */
  const emitted = new Map<string, { id: string; reference: string }>();
  /** The chunk URL map of the client build in this process. */
  let built: ChunkUrls | undefined;
  /** The feature globals of the client build and their values, set once its modules compile. */
  let defines: Map<string, string> | undefined;
  /** The files of the client build, relative to its folder. */
  let buildFiles: string[] = [];

  function getModuleId(file: string): string {
    return `/${path.relative(root, file).split(path.sep).join('/')}`;
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
    return getModuleId(path.resolve(path.dirname(path.join(root, importer)), specifier));
  }

  /**
   * Finds the modules that another module renders as a child, through Vite's resolver, so an
   * alias or a bare specifier works. The result stays until a file of the app changes.
   */
  async function findChildren(context: Rolldown.PluginContext): Promise<Set<string>> {
    if (children !== undefined) {
      return children;
    }
    const found = new Set<string>();
    resolved.clear();
    for (const file of findModules()) {
      const importer = getModuleId(file);
      for (const specifier of compiler.listChildren(readFileSync(file, 'utf8'), importer)) {
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
        found.add(id);
        resolved.set(`${importer}\0${specifier}`, getModuleId(id));
      }
    }
    children = found;
    return found;
  }

  function compileFile(
    reporter: Reporter,
    file: string,
    code?: string,
    known?: boolean,
  ): CompileResult {
    const source = code ?? readFileSync(file, 'utf8');
    // A module that is also a root takes the child output, which only adds the view chunk.
    const child = known ?? children?.has(file) === true;
    const cached = cache.get(file);
    if (cached?.source === source && cached.child === child) {
      return cached.result;
    }
    compile ??= getDefaultCompile();
    const result = compile(source, getModuleId(file), { child, resolve: resolveModule });
    reportDiagnostics(reporter, getModuleId(file), source, result.diagnostics);
    cache.set(file, { source, child, result });
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
    // The server writes the build id on the state script and drops it from the chunk map.
    if (all !== undefined && Object.hasOwn(all, BUILD_KEY)) {
      urls[BUILD_KEY] = all[BUILD_KEY];
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
      // The real path, since Vite names modules by it and a link would not match.
      root = realpathSync(config.root);
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

    async buildStart() {
      moduleFiles = undefined;
      // No module imports a chunk, since the loader takes chunk URLs from the
      // page. So each chunk is an entry of its own.
      if (isServe || this.environment.name !== 'client') {
        return;
      }
      emitted.clear();
      built = undefined;
      children = undefined;
      await findChildren(this);
      const results: CompileResult[] = [];
      for (const file of findModules()) {
        const result = compileFile(this, file);
        results.push(result);
        const name = path.basename(file, '.tsx');
        for (const chunk of listChunks(result.manifest)) {
          const reference = this.emitFile({
            type: 'chunk',
            id: getChunkId(file, chunk),
            name: `${name}.${getChunkFile(chunk).slice(0, -'.js'.length)}`,
            preserveSignature: 'exports-only',
          });
          emitted.set(getChunkId(result.manifest.module, chunk), {
            id: getChunkId(file, chunk),
            reference,
          });
        }
      }
      // Every module is compiled before the loader is bundled, so the loader sees the defines.
      defines = getDefines(getFeatures(results), options.skew !== false);
    },

    async load(id) {
      const parsed = parseChunkId(id);
      if (parsed === undefined) {
        return undefined;
      }
      this.addWatchFile(parsed.file);
      await findChildren(this);
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
      checkChunkImports(this, bundle, files);
      if (options.skew !== false) {
        const id = getBuildId(Object.keys(bundle));
        urls[BUILD_KEY] = id;
        // The loader imports this module from its own folder, to learn the server's build.
        const buildFile = path.posix.join(
          path.posix.dirname(findLoaderFile(bundle, files)),
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
          cache.get(file)?.child,
        );
        message = classifyEdit(before, after, base, timestamp);
      } catch {
        // A module that does not compile: the page loads again and shows the server's error.
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
