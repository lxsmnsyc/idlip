import { renderListener } from '../client/loader/listener.ts';
import { DEV } from '../core/dev.ts';
import { attr } from './helpers.ts';
import { renderPreload } from './preload.ts';
import { renderStyles } from './styles.ts';
import type { PreloadOptions } from './preload.ts';
import { NOTHING_PENDING, renderSync } from './render.ts';
import type { RenderOptions, RenderResult } from './render.ts';

export interface StreamOptions extends RenderOptions {
  /**
   * The URL of the loader module, for a host that built the page without the plugin. Default:
   * `RenderResult.loader`, which the plugin put in the chunk map. It becomes an async module
   * script at the end of `<head>`.
   */
  loader?: string;
  /**
   * Options of `renderPreload`, whose links go in `<head>` of the first chunk, or `false` for no
   * links. `nonce` defaults to the nonce of the stream.
   */
  preload?: PreloadOptions | false;
}

/**
 * Where a stream is. `first` has sent nothing. `pending` has sent the first render and reads
 * the pending chunks. `done` has closed.
 */
type Phase =
  | { readonly kind: 'first' }
  | {
      readonly kind: 'pending';
      readonly parts: RenderResult;
      readonly iterator: AsyncIterator<string>;
    }
  | { readonly kind: 'done' };

const TAIL = '</body></html>';

/**
 * Returns the index just after `<head>` in the markup of a document. The `<html>` tag ends at
 * the first `>` outside its quoted attribute values.
 */
function findHeadStart(html: string): number {
  let quote = false;
  for (let index = 0; index < html.length; index++) {
    const char = html[index];
    if (char === '"') {
      quote = !quote;
    } else if (char === '>' && !quote) {
      return html.startsWith('<head>', index + 1) ? index + 1 + '<head>'.length : -1;
    }
  }
  return -1;
}

/**
 * Splits the head output into its winning title and the rest. The output starts with the
 * title of the last block, which the render puts first. A title holds escaped text, so the
 * first `</title>` ends it.
 */
function splitTitle(head: string): { title: string; rest: string } {
  if (!head.startsWith('<title')) {
    return { title: '', rest: head };
  }
  const end = head.indexOf('</title>');
  if (end < 0) {
    return { title: '', rest: head };
  }
  const cut = end + '</title>'.length;
  return { title: head.slice(0, cut), rest: head.slice(cut) };
}

/**
 * The first render whole, up to `</body>`: the doctype, the document with the winning title
 * first in its `<head>` and the rest of the head output after the head elements of the
 * document, then the stylesheet links, the listener, the preload links and the loader script, and the body with the
 * state script. The tail comes after the pending chunks.
 */
function writeFirst(parts: RenderResult, options: StreamOptions): string {
  if (!parts.document) {
    throw new TypeError(
      'The root component must render <html>. Wrap it in a document component: <html><head>..</head><body>..</body></html>',
    );
  }
  const { nonce } = options;
  const loader = options.loader ?? parts.loader;
  const html = parts.body;
  const open = findHeadStart(html);
  const close = open < 0 ? -1 : html.indexOf('</head><body', open);
  if (close < 0) {
    throw new Error('The document component did not render <html><head>..</head><body>');
  }
  // The stylesheets come first, so the browser fetches them while it reads the rest of the head.
  let added = renderStyles(parts.styles, nonce) + renderListener({ nonce });
  if (options.preload !== false) {
    added += renderPreload(parts.chunks, parts.manifests, { nonce, ...options.preload });
  }
  if (loader !== undefined) {
    added += `<script type="module" async${attr('src', loader)}${attr('nonce', nonce)}></script>`;
  } else if (DEV) {
    // oxlint-disable-next-line no-console
    console.warn(
      'idlip: the page has no loader script. Build it with the idlip() plugin, or pass `loader`.',
    );
  }
  // The winning title comes first, since the browser reads the first `<title>`. The head
  // elements of the document follow it, so `<meta charset>` stays near the start, then the
  // rest of the head output, then what the server adds.
  const split = splitTitle(parts.head);
  // The closing tags go after the pending chunks, so the first chunk stops before them.
  const end = html.length - TAIL.length;
  return `<!doctype html>${html.slice(0, open)}${split.title}${html.slice(open, close)}${split.rest}${added}${html.slice(close, end)}`;
}

/** Stops the iterator of the pending chunks without waiting. A failure has no reader to tell. */
function stopIterator(iterator: AsyncIterator<string>): void {
  Promise.resolve(iterator.return?.()).catch(() => {
    // Nobody reads the stream any more.
  });
}

/** A stream of the document: the first render whole, then the pending chunks. */
function createStream(
  getParts: () => RenderResult,
  options: StreamOptions,
): ReadableStream<string> {
  let phase: Phase = { kind: 'first' };
  function hasStopped(): boolean {
    return phase.kind === 'done';
  }
  return new ReadableStream<string>({
    async pull(controller) {
      if (phase.kind === 'first') {
        // A render error or a bad parts object fails the stream before it sends a byte.
        const parts = getParts();
        const first = writeFirst(parts, options);
        const iterator =
          parts.pending === NOTHING_PENDING ? undefined : parts.pending[Symbol.asyncIterator]();
        if (iterator === undefined) {
          controller.enqueue(first + TAIL);
          controller.close();
          phase = { kind: 'done' };
        } else {
          controller.enqueue(first);
          phase = { kind: 'pending', parts, iterator };
        }
      } else if (phase.kind === 'pending') {
        // One chunk a pull, so a slow reader holds back the next one.
        const step = await phase.iterator.next();
        // The reader may have left while the chunk was in flight.
        if (hasStopped()) {
          return;
        }
        if (step.done === true) {
          controller.enqueue(TAIL);
          controller.close();
          phase = { kind: 'done' };
        } else {
          controller.enqueue(step.value);
        }
      }
    },
    cancel(reason) {
      // The reader left: abort the pending work first, since `return()` waits behind a chunk that
      // is still in flight. Then close the iterator without waiting for it.
      const current = phase;
      phase = { kind: 'done' };
      if (current.kind === 'pending') {
        current.parts.abort(reason);
        stopIterator(current.iterator);
      }
    },
  });
}

/**
 * Renders a compiled document component as a stream of the whole document. The component
 * renders `<html>`, `<head>` and `<body>`. The first chunk is the whole first render: the
 * doctype, the `<head>` with the `<Head>` output, the listener, the preload links and the loader
 * script, then `<body>` with the markup and the state script. The pending chunks of the page
 * follow, and `</body></html>` ends the document (in the first chunk when nothing is pending).
 * A component that does not render `<html>` fails the stream with a `TypeError`, as does a
 * render error, before the stream sends a byte. When the reader cancels, the stream aborts
 * `signal` of the result and stops the pending work.
 */
export function renderToStream<P>(
  component: (props: P) => unknown,
  props: P,
  options: StreamOptions = {},
): ReadableStream<string> {
  return createStream(() => renderSync(component, props, options.nonce), options);
}

/** Streams the parts that `render` returned, as `renderToStream` does. */
export function streamParts(
  parts: RenderResult,
  options: StreamOptions = {},
): ReadableStream<string> {
  return createStream(() => parts, options);
}
