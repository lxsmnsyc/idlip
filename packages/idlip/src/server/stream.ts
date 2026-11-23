import { renderListener } from '../client/loader/listener.ts';
import { attr } from './helpers.ts';
import { renderPreload } from './preload.ts';
import type { PreloadOptions } from './preload.ts';
import { NOTHING_PENDING, renderSync } from './render.ts';
import type { RenderOptions, RenderResult } from './render.ts';

export interface StreamOptions extends RenderOptions {
  /**
   * The URL of the loader module. It becomes an async module script in `<head>`, in the first
   * chunk. Leave it out when the host writes the script.
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

/** The first render whole: the opening, the head of the page, the body and the state script. */
function writeFirst(parts: RenderResult, options: StreamOptions): string {
  const { nonce, loader } = options;
  let out = `<!doctype html><html><head>${renderListener({ nonce })}`;
  if (loader !== undefined) {
    out += `<script type="module" async${attr('src', loader)}${attr('nonce', nonce)}></script>`;
  }
  if (options.preload !== false) {
    out += renderPreload(parts.chunks, parts.manifests, { nonce, ...options.preload });
  }
  return `${out}${parts.head}</head><body>${parts.body}`;
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
 * Renders a compiled component as a stream of the whole document. The first chunk is the whole
 * first render: the doctype, `<head>` with the listener, the loader script, the
 * preload links and the `<Head>` output, then `<body>` with the markup and the state script.
 * The pending chunks of the page follow, and `</body></html>` ends the document (in the first
 * chunk when nothing is pending). The component renders as soon as the stream is constructed, before the reader reads. A render error fails the stream before it sends a byte. When the reader cancels, the stream aborts `signal` of the result and stops the pending work.
 */
export function renderToStream<P>(
  component: (props: P) => unknown,
  props: P,
  options: StreamOptions = {},
): ReadableStream<string> {
  return createStream(() => renderSync(component, props, options.nonce), options);
}

/** Streams the parts that `renderPage` returned, as `renderToStream` does. */
export function streamParts(
  parts: RenderResult,
  options: StreamOptions = {},
): ReadableStream<string> {
  return createStream(() => parts, options);
}
