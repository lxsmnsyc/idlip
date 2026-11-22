// Renders the first file of a run on the server side. The REPL worker runs it, so the code of
// the files never runs in the REPL page. The tests run it in Node.
import * as core from 'idlip';
import * as server from 'idlip/server';
import { replaceChunkUrls, resolveName, rewriteImports } from './chunks.ts';
import type { ServedChunk } from './chunks.ts';
import type { CompiledFile, Project } from './project.ts';

export interface Rendered {
  head: string;
  /** The markup and the state script. */
  body: string;
}

/** What a compiled server module exports. */
interface ServerModule {
  default: (props: Record<string, unknown>) => unknown;
}

function isServerModule(value: unknown): value is ServerModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'default') === 'function'
  );
}

/** The key on `globalThis` where the server modules find the runtime of the REPL page. */
const RUNTIME_KEY = '__idlipRepl';
const RUNTIME: Record<string, object> = { 'idlip/server': server, idlip: core };

/** A module that re-exports a runtime module of this page. */
function createShim(name: string): string {
  Reflect.set(globalThis, RUNTIME_KEY, RUNTIME);
  const names: string[] = [];
  for (const key of Object.keys(RUNTIME[name])) {
    names.push(key);
  }
  return `const m = globalThis.${RUNTIME_KEY}[${JSON.stringify(name)}];\nexport const { ${names.join(', ')} } = m;\n`;
}

/**
 * Renders the first file on the server with the props. `createUrl` turns module code into a URL
 * that `import()` loads: a blob URL in the browser, a data URL in Node.
 */
export async function renderProject(
  project: Project,
  chunks: readonly ServedChunk[],
  folder: string,
  createUrl: (code: string) => string,
): Promise<Rendered> {
  const byName = new Map<string, CompiledFile>();
  for (const file of project.files) {
    byName.set(file.name, file);
  }
  const shims = new Map<string, string>();
  const urls = new Map<string, string>();

  function getShim(name: string): string {
    let url = shims.get(name);
    if (url === undefined) {
      url = createUrl(createShim(name));
      shims.set(name, url);
    }
    return url;
  }

  // Each server module imports the runtime and the server modules of its children.
  function getServerUrl(name: string, path: readonly string[]): string {
    const known = urls.get(name);
    if (known !== undefined) {
      return known;
    }
    const file = byName.get(name);
    if (file === undefined) {
      throw new Error(`${name} is not a file of this REPL`);
    }
    if (path.includes(name)) {
      throw new Error(`${[...path, name].join(' renders ')}: a module cannot render itself`);
    }
    const code = rewriteImports(
      replaceChunkUrls(file.result.server, file, chunks, folder),
      (specifier) => {
        if (Object.hasOwn(RUNTIME, specifier)) {
          return getShim(specifier);
        }
        const child = resolveName(specifier);
        if (child === undefined) {
          throw new Error(`${name} imports ${specifier}. The REPL runs idlip and its own files.`);
        }
        return getServerUrl(child, [...path, name]);
      },
    );
    const url = createUrl(code);
    urls.set(name, url);
    return url;
  }

  const entry = project.files.at(0);
  if (entry === undefined) {
    throw new Error('There is no file to render');
  }
  const loaded: unknown = await import(/* @vite-ignore */ getServerUrl(entry.name, []));
  if (!isServerModule(loaded)) {
    throw new TypeError(`${entry.name} has no default export to render`);
  }
  const page = await server.renderPage(loaded.default, project.props);
  return { head: page.head, body: page.body };
}

/** A data URL of module code, for Node, which has no blob URLs to import. */
export function createDataUrl(code: string): string {
  // A quote would end the specifier that names the URL in an import.
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code).replaceAll("'", '%27')}`;
}
