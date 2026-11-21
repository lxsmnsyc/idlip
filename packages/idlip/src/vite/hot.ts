import { getChunkId } from '../core/format.ts';
import type { CompileResult } from '../core/format.ts';
import type { HotMessage } from '../client/hot.ts';
import { listChunks } from './chunks.ts';

/** The custom event the plugin sends to the page. Its payload is a `HotMessage`. */
export const HOT_EVENT = 'idlip:hot';

function getUrl(base: string, result: CompileResult, chunk: string): string {
  return `${base}${getChunkId(result.manifest.module, chunk).slice(1)}`;
}

/**
 * Compares the compile output of a module before and after an edit. The server module holds
 * the markup, the manifest and the chunk ids, so when it is the same the page keeps its
 * markup, groups and handler names, and only the chunks whose code changed load again.
 * Returns `undefined` when nothing the page runs changed.
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
    for (const chunk of listChunks(after.manifest)) {
      chunks.push(getUrl(base, after, chunk));
    }
    return { module, kind: 'remount', chunks, timestamp };
  }
  const old = new Map<string, string>();
  for (const item of before.client) {
    old.set(item.chunk, item.code);
  }
  const chunks: string[] = [];
  for (const item of after.client) {
    if (old.get(item.chunk) !== item.code) {
      chunks.push(getUrl(base, after, item.chunk));
    }
  }
  return chunks.length === 0 ? undefined : { module, kind: 'swap', chunks, timestamp };
}
