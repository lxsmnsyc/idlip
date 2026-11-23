import { getChunkId, listCompiled } from '../core/format.ts';
import type { CompileResult } from '../core/format.ts';
import type { HotMessage } from '../client/hot.ts';
import { listChunks } from './chunks.ts';

/** The custom event the plugin sends to the page. Its payload is a `HotMessage`. */
export const HOT_EVENT = 'idlip:hot';

function getUrl(base: string, module: string, chunk: string): string {
  return `${base}${getChunkId(module, chunk).slice(1)}`;
}

/**
 * Returns the shell of each document in the server module: the render code from `<html` to
 * the `<body` tag, which holds the attributes of `<html>` and the static head.
 */
function readShells(result: CompileResult): string[] {
  const shells: string[] = [];
  const { server } = result;
  for (
    let start = server.indexOf('<html');
    start !== -1;
    start = server.indexOf('<html', start + 1)
  ) {
    const end = server.indexOf('<body', start);
    shells.push(end === -1 ? server.slice(start) : server.slice(start, end));
  }
  return shells;
}

/**
 * Tells whether an edit changed the shell of a document component: `<html>`, its attributes or
 * its head. A remount swaps `<body>` only, so such an edit loads the page again.
 */
export function changesShell(before: CompileResult | undefined, after: CompileResult): boolean {
  const next = readShells(after);
  if (before === undefined || next.length === 0) {
    return false;
  }
  const old = readShells(before);
  return old.length !== next.length || old.some((shell, index) => shell !== next[index]);
}

/**
 * Compares the compile output of a module before and after an edit. The server module holds
 * the markup, the manifests and the chunk ids of every component of the file, so when it is
 * the same the page keeps its markup, groups and handler names, and only the chunks whose code
 * changed load again. Returns `undefined` when nothing the page runs changed.
 */
export function classifyEdit(
  before: CompileResult | undefined,
  after: CompileResult,
  base: string,
  timestamp: number,
): HotMessage | undefined {
  const module = after.manifest.module;
  if (before === undefined || before.server !== after.server) {
    const chunks: string[] = [];
    for (const { manifest } of listCompiled(after)) {
      for (const chunk of listChunks(manifest)) {
        chunks.push(getUrl(base, manifest.module, chunk));
      }
    }
    return { module, kind: 'remount', chunks, timestamp };
  }

  // The same server module means the same components, so chunks compare by module and name.
  const old = new Map<string, string>();
  for (const { manifest, client } of listCompiled(before)) {
    for (const item of client) {
      old.set(getChunkId(manifest.module, item.chunk), item.code);
    }
  }
  const chunks: string[] = [];
  for (const { manifest, client } of listCompiled(after)) {
    for (const item of client) {
      if (old.get(getChunkId(manifest.module, item.chunk)) !== item.code) {
        chunks.push(getUrl(base, manifest.module, item.chunk));
      }
    }
  }
  return chunks.length === 0 ? undefined : { module, kind: 'swap', chunks, timestamp };
}
