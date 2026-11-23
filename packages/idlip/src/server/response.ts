import { DEV } from '../core/dev.ts';
import { render } from './render.ts';
import { streamParts } from './stream.ts';
import type { StreamOptions } from './stream.ts';

/** Sources to add to the directives of idlip's content security policy. */
export interface CspOptions {
  /**
   * Sources added to a directive by name, such as `{ 'style-src': ["'self'"], 'img-src': ['https:'] }`.
   * A directive that the policy lacks is added. `default-src` is `'none'`, so adding sources to it
   * replaces `'none'`. `script-src` and `trusted-types` cannot be extended.
   */
  extend?: Readonly<Record<string, readonly string[]>>;
}

export interface ResponseOptions extends StreamOptions {
  /**
   * Makes a nonce, writes it on every script and link the server adds, and sets the
   * `content-security-policy` header. `true` is idlip's policy. In development it sends no
   * header, since Vite's client and error overlay need more than the policy allows, but the
   * nonce is still written. A `nonce` option replaces the nonce it would make.
   */
  csp?: boolean | CspOptions;
  /** The status of the response. Default: 200. */
  status?: number;
  /** Headers of the response. `content-type` defaults to `text/html; charset=utf-8`. */
  headers?: HeadersInit;
}

/** The directives that name the nonce or the trusted types policy, which a page cannot loosen. */
const LOCKED = new Set(['script-src', 'trusted-types']);

const DIRECTIVE = /^[a-z][a-z-]*$/;
const SOURCE = /^[^\s;,]+$/;

/** Makes a nonce of 16 random bytes, in base64. */
function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCodePoint(...bytes));
}

/**
 * Returns the content security policy of a page: no source but its nonced scripts, and the
 * scripts that those load. Trusted Types are required, with the one policy that the loader makes.
 */
export function createPolicy(nonce: string, options: CspOptions = {}): string {
  const directives = new Map<string, string[]>([
    ['default-src', ["'none'"]],
    ['script-src', [`'nonce-${nonce}'`, "'strict-dynamic'"]],
    ['base-uri', ["'none'"]],
    ['object-src', ["'none'"]],
    ['require-trusted-types-for', ["'script'"]],
    ['trusted-types', ['idlip']],
  ]);
  for (const [name, sources] of Object.entries(options.extend ?? {})) {
    if (!DIRECTIVE.test(name)) {
      throw new TypeError(`csp.extend: "${name}" is not a directive name`);
    }
    if (LOCKED.has(name)) {
      throw new TypeError(`csp.extend: ${name} cannot be extended`);
    }
    for (const source of sources) {
      if (!SOURCE.test(source)) {
        throw new TypeError(`csp.extend: "${source}" is not a source of ${name}`);
      }
    }
    const kept = directives.get(name) ?? [];
    // `'none'` stands alone, so a source replaces it.
    const base = kept.length === 1 && kept[0] === "'none'" && sources.length > 0 ? [] : kept;
    directives.set(name, [...base, ...sources]);
  }
  const parts: string[] = [];
  for (const [name, sources] of directives) {
    parts.push(`${name} ${sources.join(' ')}`);
  }
  return parts.join('; ');
}

/** Encodes the chunks of a stream, after its first chunk was read, so a failure comes before the headers. */
function encodeStream(
  reader: ReadableStreamDefaultReader<string>,
  first: ReadableStreamReadResult<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) {
        controller.enqueue(encoder.encode(first.value));
      }
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(next.value));
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/**
 * Renders a compiled document component and returns the page as a `Response`. The returned
 * promise rejects when the render fails or the component does not render `<html>`, before any
 * header is decided, so a host can answer 500. The body streams: the first chunk is the whole
 * first render, and the pending chunks follow.
 */
export async function renderToResponse<P>(
  component: (props: P) => unknown,
  props: P,
  options: ResponseOptions = {},
): Promise<Response> {
  const { csp, status, headers, ...rest } = options;
  const nonce = options.nonce ?? (csp === undefined || csp === false ? undefined : createNonce());
  const parts = await render(component, props, { nonce });
  const stream = streamParts(parts, { ...rest, nonce });
  const reader = stream.getReader();
  const first = await reader.read();
  const out = new Headers(headers);
  if (!out.has('content-type')) {
    out.set('content-type', 'text/html; charset=utf-8');
  }
  if (nonce !== undefined && csp !== undefined && csp !== false) {
    // Built in development too, so a bad `extend` fails there and not only in production.
    const policy = createPolicy(nonce, csp === true ? {} : csp);
    if (!DEV) {
      out.set('content-security-policy', policy);
    }
  }
  return new Response(encodeStream(reader, first), { status, headers: out });
}
