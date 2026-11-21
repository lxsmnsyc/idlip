import { getChunkId } from '../core/format.ts';
import type { ChunkUrls, Manifest } from '../core/format.ts';

export interface PreloadOptions {
  /** Event types to preload for, most likely first. Default: `['click']`. */
  events?: readonly string[];
  /** The most chunks to name. Default: 8. See `renderPreload` for which ones are kept. */
  max?: number;
  /** `link` returns `<link>` tags. `header` returns a `Link` header value for 103 Early Hints. */
  format?: 'link' | 'header';
  /** Written on each `<link>` tag, for a page with a script nonce policy. */
  nonce?: string;
  /** Written on each preload, for chunks served from another origin. */
  crossorigin?: 'anonymous' | 'use-credentials';
}

const DEFAULT_MAX = 8;

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeTarget(value: string): string {
  return value.replaceAll('<', '%3C').replaceAll('>', '%3E').replaceAll(',', '%2C');
}

/**
 * Returns the chunk URLs to preload. It walks the event types in the given order, then the
 * manifests in the given order, then the handler names of that event in sorted order. For each
 * handler it takes the handler chunk and then the binding chunks of its `bindings`. It stops
 * at `max`, so the earliest events and handlers win.
 */
function findUrls(
  chunks: ChunkUrls,
  manifests: readonly Manifest[],
  events: readonly string[],
  max: number,
): string[] {
  const urls = new Set<string>();
  function add(manifest: Manifest, chunk: string): void {
    const id = getChunkId(manifest.module, chunk);
    if (Object.hasOwn(chunks, id) && urls.size < max) {
      urls.add(chunks[id]);
    }
  }
  for (const event of events) {
    for (const manifest of manifests) {
      if (manifest.listens === undefined || !Object.hasOwn(manifest.listens, event)) {
        continue;
      }
      for (const name of manifest.listens[event]) {
        if (!Object.hasOwn(manifest.handlers, name)) {
          continue;
        }
        const entry = manifest.handlers[name];
        add(manifest, entry.chunk);
        for (const key of entry.bindings ?? []) {
          if (Object.hasOwn(manifest.groups, key)) {
            add(manifest, manifest.groups[key].chunk);
          }
        }
      }
    }
  }
  return [...urls];
}

/**
 * Names the chunks of the first click so the browser fetches them with the page. It reads
 * `manifest.listens` of the root manifest, and of the child manifests when the page has
 * children (the manifests of the server modules): the handlers the view dispatches on each event
 * and the binding chunks of their write sets. Nothing else is named. It needs no markup, so
 * the result can go out in a `Link` header as soon as the request is known. Put the `<link>`
 * tags in `<head>`, or send the `header` format with a 103 response. The loader imports the
 * same URLs, so the browser reuses each preload. Without handlers it returns an empty string.
 * A handler that a child dispatches through a message prop belongs to its parent and is found
 * through the parent's manifest.
 */
export function renderPreload(
  chunks: ChunkUrls,
  manifest: Manifest | readonly Manifest[],
  options: PreloadOptions = {},
): string {
  const manifests = 'module' in manifest ? [manifest] : manifest;
  const urls = findUrls(chunks, manifests, options.events ?? ['click'], options.max ?? DEFAULT_MAX);
  const crossorigin = options.crossorigin;
  if (options.format === 'header') {
    let param = '';
    if (crossorigin === 'anonymous') {
      param = '; crossorigin';
    } else if (crossorigin === 'use-credentials') {
      param = '; crossorigin=use-credentials';
    }
    const items: string[] = [];
    for (const url of urls) {
      items.push(`<${escapeTarget(url)}>; rel=modulepreload${param}`);
    }
    return items.join(', ');
  }
  const nonce = options.nonce === undefined ? '' : ` nonce="${escapeAttr(options.nonce)}"`;
  const origin = crossorigin === undefined ? '' : ` crossorigin="${crossorigin}"`;
  let out = '';
  for (const url of urls) {
    out += `<link rel="modulepreload" href="${escapeAttr(url)}"${origin}${nonce}>`;
  }
  return out;
}
