// Lays out the client chunks of a run: their file names in the run folder and their imports.
// The REPL page runs it, so it imports no compiler and no runtime.
import type { CompiledFile, Project } from './project.ts';

/** A client chunk as a run serves it. */
export interface ServedChunk {
  /** The file that the chunk comes from. */
  file: string;
  /** The chunk name, such as `handler=increment`. */
  chunk: string;
  /** The file name in the run folder, such as `counter.handler.increment.js`. */
  path: string;
  code: string;
}

/** The file of a relative specifier, such as `./counter.idlip.tsx`, by name. */
export function resolveName(specifier: string): string | undefined {
  return /^\.\/([^/]+)$/.exec(specifier)?.[1];
}
/** The module id of a chunk, as the compiled code names it. */
function getChunkId(id: string, chunk: string): string {
  return `${id}?idlip-${chunk}&lang.js`;
}

/** The file name of a chunk: `counter.idlip.tsx` and `binding=items.*.id` give `counter.binding.items._.id.js`. */
function getChunkPath(file: string, chunk: string): string {
  const stem = file.slice(0, -'.idlip.tsx'.length);
  const name = chunk.replace('=', '.').replaceAll(/[^\w.-]/g, '_');
  return `${stem}.${name}.js`;
}

/** Replaces the import specifiers of a module. */
export function rewriteImports(code: string, resolve: (specifier: string) => string): string {
  return code.replaceAll(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\2/g,
    (_all, before: string, quote: string, specifier: string) =>
      `${before}${quote}${resolve(specifier)}${quote}`,
  );
}

/** Adds the imported names of an import list, such as `a, b as c`. */
function addNames(names: Set<string>, list: string): void {
  for (const part of list.split(',')) {
    const name = part.trim().split(/\s+as\s+/)[0];
    if (name !== '') {
      names.add(name);
    }
  }
}

/**
 * The module that the client chunks import `idlip/client` and `idlip` from. It re-exports the
 * names they import from the object that `runtime.ts` sets in the frame.
 */
export function writeFrameShim(project: Project): string {
  const names = new Set<string>();
  const imports = /import\s*\{([^}]*)\}\s*from\s*'idlip(?:\/client)?'/g;
  for (const file of project.files) {
    for (const module of file.result.client) {
      for (const match of module.code.matchAll(imports)) {
        addNames(names, match[1]);
      }
    }
  }
  return `const m = globalThis.__idlipFrame;\nexport const { ${[...names].join(', ')} } = m;\n`;
}

/**
 * The client chunks of a run. `folder` is the URL of the run folder and `runtime` the URL of
 * the module that `writeFrameShim` writes.
 */
export function listChunks(project: Project, folder: string, runtime: string): ServedChunk[] {
  const urls = new Map<string, string>();
  const chunks: ServedChunk[] = [];
  const taken = new Set<string>();
  for (const file of project.files) {
    for (const module of file.result.client) {
      let path = getChunkPath(file.name, module.chunk);
      // Two chunk names can share a file name once `*` and other marks become `_`.
      for (let count = 2; taken.has(path); count++) {
        path = getChunkPath(file.name, `${module.chunk}-${count}`);
      }
      taken.add(path);
      urls.set(getChunkId(file.id, module.chunk), `${folder}${path}`);
      chunks.push({ file: file.name, chunk: module.chunk, path, code: module.code });
    }
  }
  for (const chunk of chunks) {
    chunk.code = rewriteImports(chunk.code, (specifier) => {
      if (specifier === 'idlip/client' || specifier === 'idlip') {
        return runtime;
      }
      return urls.get(specifier) ?? specifier;
    });
  }
  return chunks;
}

/** Points the `chunks` table of a server module at the files of the run. */
export function replaceChunkUrls(
  code: string,
  file: CompiledFile,
  chunks: readonly ServedChunk[],
  folder: string,
): string {
  let result = code;
  for (const chunk of chunks) {
    if (chunk.file === file.name) {
      const id = `'${getChunkId(file.id, chunk.chunk)}'`;
      result = result.replace(`${id}: ${id}`, `${id}: '${folder}${chunk.path}'`);
    }
  }
  return result;
}
