import { parseSync } from 'oxc-parser';
import type { ObjectExpression, Program } from '@oxc-project/types';
import type { ChunkUrls, Manifest } from '../core/format.ts';
import { BUILD_KEY } from './skew.ts';

/**
 * `<file>?idlip-<Name>.<kind>=<name>&lang.js`, where `<Name>.` is there for a component other
 * than the default export. Group 1 is the component's name, group 2 the chunk name, such as
 * `handler=toggle`. A component name starts with a capital letter and a chunk kind does not.
 */
const CHUNK_QUERY =
  /\?idlip-(?:([A-Z][^.&=?]*)\.)?((?:(?:handler|binding|list|task|source|try)=[^&]*|view))&lang\.js$/;

/**
 * Splits a chunk id into the source file, the module id of its component and the chunk name.
 * The module id is the file for the default export and `<file>#<Name>` for any other component.
 * Returns undefined for any other id.
 */
export function parseChunkId(
  id: string,
): { file: string; module: string; chunk: string } | undefined {
  const match = CHUNK_QUERY.exec(id);
  if (match === null) {
    return undefined;
  }
  const file = id.slice(0, match.index);
  const name = match.at(1);
  return {
    file,
    module: name === undefined ? file : `${file}#${decodeURIComponent(name)}`,
    chunk: decodeURIComponent(match[2]),
  };
}

/**
 * Checks that a value read from JSON is a chunk URL map.
 */
export function isChunkUrls(value: unknown): value is ChunkUrls {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  for (const url of Object.values(value)) {
    if (typeof url !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Returns every chunk name of a manifest: handlers, tasks, sources, binding groups, lists, `<Try>`
 * fallbacks and the view of a child,
 * each once.
 */
export function listChunks(manifest: Manifest): string[] {
  const chunks = new Set<string>();
  for (const entry of Object.values(manifest.handlers)) {
    chunks.add(entry.chunk);
  }
  for (const chunk of Object.values(manifest.tasks ?? {})) {
    chunks.add(chunk);
  }
  for (const name of manifest.sources ?? []) {
    chunks.add(`source=${name}`);
  }
  for (const group of Object.values(manifest.groups)) {
    chunks.add(group.chunk);
  }
  for (const list of Object.values(manifest.lists)) {
    chunks.add(list.chunk);
  }
  for (const chunk of Object.values(manifest.fallback ?? {})) {
    chunks.add(chunk);
  }
  if (manifest.view !== undefined) {
    chunks.add(manifest.view.chunk);
  }
  return [...chunks];
}

/** Reads the string keys of an object literal. */
function readKeys(node: ObjectExpression): string[] {
  const keys: string[] = [];
  for (const property of node.properties) {
    if (property.type === 'Property' && property.key.type === 'Literal') {
      keys.push(String(property.key.value));
    }
  }
  return keys;
}

/**
 * Whether a declaration is a module record the compiler generates: `$Name = { manifest, chunks,
 * default: Name }`, where the record's name is `$` and the name of its render function.
 */
function isRecord(name: string, init: ObjectExpression): boolean {
  let manifest = false;
  let render = false;
  for (const property of init.properties) {
    if (property.type !== 'Property' || property.key.type !== 'Identifier') {
      continue;
    }
    if (property.key.name === 'manifest') {
      manifest = true;
    } else if (
      property.key.name === 'default' &&
      property.value.type === 'Identifier' &&
      `$${property.value.name}` === name
    ) {
      render = true;
    }
  }
  return manifest && render;
}

/**
 * Lists the chunk maps of a compiled server module: the value of `export const chunks = {…}`
 * and the `chunks` field of each module record `const $Name = { …, chunks: {…} }`.
 */
function findChunkMaps(program: Program): ObjectExpression[] {
  const maps: ObjectExpression[] = [];
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of declaration.declarations) {
      if (declarator.id.type !== 'Identifier' || declarator.init?.type !== 'ObjectExpression') {
        continue;
      }
      if (declarator.id.name === 'chunks' && statement.type === 'ExportNamedDeclaration') {
        maps.push(declarator.init);
      } else if (isRecord(declarator.id.name, declarator.init)) {
        for (const property of declarator.init.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'chunks' &&
            property.value.type === 'ObjectExpression'
          ) {
            maps.push(property.value);
          }
        }
      }
    }
  }
  return maps;
}

/**
 * Replaces the chunk maps in a compiled server module with the URLs of the given map. Each map
 * keeps its own chunk ids, and takes the build id of the map when there is one.
 */
export function replaceChunkUrls(code: string, urls: ChunkUrls): string {
  const program = parseSync('server.js', code, { lang: 'js', sourceType: 'module' }).program;
  const maps = findChunkMaps(program);
  if (maps.length === 0) {
    throw new Error('The compiled server module has no `export const chunks`');
  }

  // Replace from the end, so the earlier offsets stay valid.
  let out = code;
  for (const map of maps.toReversed()) {
    const own: Record<string, string> = {};
    for (const key of readKeys(map)) {
      own[key] = Object.hasOwn(urls, key) ? urls[key] : key;
    }
    if (Object.hasOwn(urls, BUILD_KEY)) {
      own[BUILD_KEY] = urls[BUILD_KEY];
    }
    out = `${out.slice(0, map.start)}${JSON.stringify(own, null, 2)}${out.slice(map.end)}`;
  }
  return out;
}
