import { renderListener } from '../client/loader/listener.ts';
import { attr } from './helpers.ts';
import { renderPreload } from './preload.ts';
import type { PreloadOptions } from './preload.ts';
import { NOTHING_PENDING, renderSync } from './render.ts';
import type { RenderOptions, RenderResult } from './render.ts';

export interface StreamOptions extends RenderOptions {
  /**
   * The URL of the loader module. It becomes an async module script in `<head>`, sent before the
   * page renders. Leave it out when the host writes the script.
   */
  loader?: string;
  /**
   * Options of `renderPreload`, whose links go in `<head>` after the page renders, or `false` for
   * no links. `nonce` defaults to the nonce of the stream.
   */
  preload?: PreloadOptions | false;
  /** Markup at the start of `<head>`, such as `<meta charset>` and `<title>`. */
  head?: string;
}

/**
 * Where a stream is. `first` has sent nothing. `pending` has sent the first render and reads
 * the pending chunks. `done` has closed.
 */
type Phase =
  | { readonly kind: 'first' }
  | { readonly kind: 'pending'; readonly iterator: AsyncIterator<string> }
  | { readonly kind: 'done' };

const TAIL = '</body></html>';

/** The first render whole: the opening, the head of the page, the body and the state script. */
function writeFirst(parts: RenderResult, options: StreamOptions): string {
  const { nonce, loader } = options;
  let out = `<!doctype html><html><head>${options.head ?? ''}${renderListener({ nonce })}`;
  if (loader !== undefined) {
    out += `<script type="module" async${attr('src', loader)}${attr('nonce', nonce)}></script>`;
  }
  if (options.preload !== false) {
    out += renderPreload(parts.chunks, parts.manifests, { nonce, ...options.preload });
  }
  return `${out}${parts.head}</head><body>${parts.body}`;
}

/** A stream of the document: the first render whole, then the pending chunks. */
function createStream(
  getParts: () => RenderResult,
  options: StreamOptions,
): ReadableStream<string> {
  let phase: Phase = { kind: 'first' };
  return new ReadableStream<string>({
    async pull(controller) {
      switch (phase.kind) {
        case 'first': {
          // A render error here fails the stream before it sends a byte.
          const parts = getParts();
          const first = writeFirst(parts, options);
          if (parts.pending === NOTHING_PENDING) {
            controller.enqueue(first + TAIL);
            controller.close();
            phase = { kind: 'done' };
          } else {
            controller.enqueue(first);
            phase = { kind: 'pending', iterator: parts.pending[Symbol.asyncIterator]() };
          }
          break;
        }
        case 'pending': {
          // One chunk a pull, so a slow reader holds back the next one.
          const step = await phase.iterator.next();
          if (step.done === true) {
            controller.enqueue(TAIL);
            controller.close();
            phase = { kind: 'done' };
          } else {
            controller.enqueue(step.value);
          }
          break;
        }
        case 'done': {
          break;
        }
      }
    },
    async cancel() {
      // The reader left: stop the pending work that nobody waits for.
      if (phase.kind === 'pending') {
        const { iterator } = phase;
        phase = { kind: 'done' };
        await iterator.return?.();
      }
      phase = { kind: 'done' };
    },
  });
}

/**
 * Renders a compiled component as a stream of the whole document. The first chunk is the whole
 * first render: the doctype, `<head>` with `options.head`, the listener, the loader script, the
 * preload links and the `<Head>` output, then `<body>` with the markup and the state script.
 * The pending chunks of the page follow, and `</body></html>` ends the document (in the first
 * chunk when nothing is pending). A render error fails the stream before it sends a byte.
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
