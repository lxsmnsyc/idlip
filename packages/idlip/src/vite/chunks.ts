import { parseSync } from 'oxc-parser';
import type { ChunkUrls, Manifest } from '../core/format.ts';

/** `<file>?idlip-<kind>=<name>&lang.js`. Group 1 is the chunk name, such as `handler=toggle`. */
const CHUNK_QUERY = /\?idlip-((?:(?:handler|binding|list|task|source|try)=[^&]*|view))&lang\.js$/;

/**
 * Splits a chunk id into the source file and the chunk name. Returns undefined
 * for any other id.
 */
export function parseChunkId(id: string): { file: string; chunk: string } | undefined {
  const match = CHUNK_QUERY.exec(id);
  if (match === null) {
    return undefined;
  }
  return { file: id.slice(0, match.index), chunk: decodeURIComponent(match[1]) };
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

/**
 * Replaces the value of `export const chunks = {…}` in a compiled server module
 * with the given map.
 */
export function replaceChunkUrls(code: string, urls: ChunkUrls): string {
  const program = parseSync('server.js', code, { lang: 'js', sourceType: 'module' }).program;
  for (const statement of program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    ) {
      continue;
    }
    for (const declarator of statement.declaration.declarations) {
      if (
        declarator.id.type === 'Identifier' &&
        declarator.id.name === 'chunks' &&
        declarator.init !== null
      ) {
        const { start, end } = declarator.init;
        return `${code.slice(0, start)}${JSON.stringify(urls, null, 2)}${code.slice(end)}`;
      }
    }
  }
  throw new Error('The compiled server module has no `export const chunks`');
}
