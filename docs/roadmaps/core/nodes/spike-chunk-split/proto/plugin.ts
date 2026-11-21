/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// Prototype of `idlip/vite`: splits each `*.idlip.tsx` module into one chunk
// per handler and one per binding group, and gives the server their URLs.
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EnvironmentModuleNode, Plugin } from 'vite';
import { compileModule, type CompiledModule, type HelperMode } from './stub-compiler.ts';

const SUFFIX = /\.idlip\.tsx$/;
/**
 * `<file>?idlip-handler=<name>&lang.tsx`, `<file>?idlip-binding=<path>&lang.tsx` and
 * `<file>?idlip-helpers&lang.tsx`. Vite picks the loader from the end of the id, so a
 * binding path such as `todos.*.done` must not end it.
 */
const QUERY = /\?idlip-(handler|binding|helpers)(?:=([^&]*))?&lang\.tsx$/;
const LANG = '&lang.tsx';
const MANIFEST = 'virtual:idlip/manifest';
const MANIFEST_FILE = '.idlip/manifest.json';

/** Chunk URLs of one module, by kind and name. */
interface ModuleChunks {
  handlers: Record<string, string>;
  bindings: Record<string, string>;
}

type Manifest = Record<string, ModuleChunks>;

export interface IdlipOptions {
  /** Copy module-level helpers into each chunk, or import them from one module. */
  helpers?: HelperMode;
}

export function idlip(options: IdlipOptions = {}): Plugin {
  const mode = options.helpers ?? 'inline';
  let root = '';
  let base = '/';
  let isServe = false;
  let clientOutDir = '';
  /** The manifest of the client build in this process, for the server build after it. */
  let builtManifest: Manifest | undefined;
  /** Emitted chunk references of the client build, by chunk id. */
  const emitted = new Map<string, string>();
  /** Compiled modules by file, with the source they came from. */
  const cache = new Map<string, { code: string; result: CompiledModule }>();
  /** The compiled module each environment last loaded a chunk from, by `<env>:<file>`. */
  const served = new Map<string, CompiledModule>();

  function compileFile(file: string): CompiledModule {
    const code = readFileSync(file, 'utf8');
    const cached = cache.get(file);
    if (cached?.code === code) {
      return cached.result;
    }
    const result = compileModule(file, code, `${file}?idlip-helpers${LANG}`, mode);
    cache.set(file, { code, result });
    return result;
  }

  function findModules(): string[] {
    const files: string[] = [];
    for (const name of globSync('src/**/*.idlip.tsx', { cwd: root })) {
      files.push(path.join(root, name));
    }
    return files;
  }

  function getModuleId(file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
  }

  /** The chunk ids of a module: the file path with an idlip query. */
  function listChunkIds(file: string): { kind: keyof ModuleChunks; name: string; id: string }[] {
    const compiled = compileFile(file);
    const ids: { kind: keyof ModuleChunks; name: string; id: string }[] = [];
    for (const name of compiled.handlers.keys()) {
      ids.push({ kind: 'handlers', name, id: `${file}?idlip-handler=${name}${LANG}` });
    }
    for (const name of compiled.bindings.keys()) {
      ids.push({ kind: 'bindings', name, id: `${file}?idlip-binding=${name}${LANG}` });
    }
    return ids;
  }

  /** On the dev server a chunk's URL is its id under the root, served by Vite. */
  function createDevManifest(): Manifest {
    const manifest: Manifest = {};
    for (const file of findModules()) {
      const chunks: ModuleChunks = { handlers: {}, bindings: {} };
      for (const { kind, name, id } of listChunkIds(file)) {
        chunks[kind][name] = `${base}${getModuleId(id)}`;
      }
      manifest[getModuleId(file)] = chunks;
    }
    return manifest;
  }

  function readBuiltManifest(): Manifest {
    if (builtManifest) {
      return builtManifest;
    }
    return JSON.parse(readFileSync(path.join(clientOutDir, MANIFEST_FILE), 'utf8')) as Manifest;
  }

  return {
    name: 'idlip-spike',
    // Run before Vite's TypeScript transform, which strips the types the stub
    // compiler leaves in. The real compiler emits JavaScript.
    enforce: 'pre',
    sharedDuringBuild: true,

    configResolved(config) {
      root = config.root;
      base = config.base;
      isServe = config.command === 'serve';
      clientOutDir = path.resolve(root, config.environments.client!.build.outDir);
    },

    buildStart() {
      // Each chunk of the client build is an entry of its own, so the build
      // keeps it as one file even though no module imports it.
      if (isServe || this.environment.name !== 'client') {
        return;
      }
      emitted.clear();
      for (const file of findModules()) {
        for (const { name, id } of listChunkIds(file)) {
          const reference = this.emitFile({
            type: 'chunk',
            id,
            name: `${path.basename(file, '.idlip.tsx')}.${name.replaceAll('*', '_')}`,
            preserveSignature: 'exports-only',
          });
          emitted.set(id, reference);
        }
      }
    },

    resolveId(id) {
      if (id === MANIFEST) {
        return `\0${MANIFEST}`;
      }
      return undefined;
    },

    load(id) {
      if (id === `\0${MANIFEST}`) {
        const manifest = isServe ? createDevManifest() : readBuiltManifest();
        return `export const chunks = ${JSON.stringify(manifest, null, 2)};`;
      }
      const match = QUERY.exec(id);
      if (!match) {
        return undefined;
      }
      const file = id.slice(0, match.index);
      this.addWatchFile(file);
      const compiled = compileFile(file);
      served.set(`${this.environment.name}:${file}`, compiled);
      const [, kind, name] = match;
      let code: string | undefined;
      if (kind === 'helpers') {
        code = compiled.helpers;
      } else if (kind === 'handler') {
        code = compiled.handlers.get(name!);
      } else {
        code = compiled.bindings.get(decodeURIComponent(name!));
      }
      if (code === undefined) {
        this.error(`${getModuleId(file)} has no ${kind} ${name}`);
      }
      return { code, moduleType: 'tsx' };
    },

    transform: {
      filter: { id: SUFFIX },
      handler(_code, id) {
        // The source module itself is the server renderer. The client never
        // imports it, since the loader takes chunk URLs from the page.
        const compiled = compileFile(id);
        return {
          code: `${compiled.server}\nexport default { id: ${JSON.stringify(getModuleId(id))}, render: renderModel };`,
          moduleType: 'tsx',
        };
      },
    },

    generateBundle(_output, bundle) {
      if (this.environment.name !== 'client') {
        return;
      }
      // Map each emitted chunk to its output file.
      const manifest: Manifest = {};
      for (const file of findModules()) {
        const chunks: ModuleChunks = { handlers: {}, bindings: {} };
        for (const { kind, name, id } of listChunkIds(file)) {
          chunks[kind][name] = `${base}${this.getFileName(emitted.get(id)!)}`;
        }
        manifest[getModuleId(file)] = chunks;
      }
      builtManifest = manifest;
      this.emitFile({
        type: 'asset',
        fileName: MANIFEST_FILE,
        source: JSON.stringify(manifest, null, 2),
      });
      // Log every chunk with what it holds, for the spike's measurements.
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          const modules: string[] = [];
          for (const id of item.moduleIds) {
            modules.push(getModuleId(id));
          }
          this.info(
            `${item.fileName} ${item.code.length}B entry=${item.isEntry} imports=[${item.imports.join(', ')}] modules=[${modules.join(', ')}]`,
          );
        }
      }
    },

    hotUpdate({ file, modules, timestamp }) {
      if (!SUFFIX.test(file)) {
        return undefined;
      }
      // Compare the chunks before and after the edit, to see which changed.
      const key = `${this.environment.name}:${file}`;
      const before = served.get(key);
      const after = compileFile(file);
      served.set(key, after);
      const changed: string[] = [];
      for (const kind of ['handlers', 'bindings'] as const) {
        const names = new Set([...(before?.[kind].keys() ?? []), ...after[kind].keys()]);
        for (const name of names) {
          if (before?.[kind].get(name) !== after[kind].get(name)) {
            changed.push(`${kind}:${name}`);
          }
        }
      }
      // Vite lists every module of this file that the environment has loaded:
      // the source module and each chunk id with a query.
      const invalidated = new Set<EnvironmentModuleNode>();
      const graph = this.environment.moduleGraph;
      const ids: string[] = [];
      for (const module of modules) {
        ids.push(getModuleId(module.id ?? module.url));
        graph.invalidateModule(module, invalidated, timestamp, true);
      }
      // The chunk list feeds the manifest, so it goes stale with the file.
      const manifest = graph.getModuleById(`\0${MANIFEST}`);
      if (manifest) {
        graph.invalidateModule(manifest, invalidated, timestamp, true);
        ids.push(MANIFEST);
      }
      console.log(
        `[idlip] hotUpdate env=${this.environment.name} file=${getModuleId(file)} changed=[${changed.join(', ')}] invalidated=[${ids.join(', ')}]`,
      );
      // A changed chunk cannot patch a page whose DOM came from the old view,
      // so the prototype reloads the page.
      if (this.environment.name === 'client') {
        this.environment.hot.send({ type: 'full-reload' });
      }
      return [];
    },
  };
}
