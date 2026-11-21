// The attributes that hold a URL. The compiler wraps a bound value of each one in `safeUrl`
// (`helpers.ts`), which drops a `javascript:` or `vbscript:` URL. A static value written in
// source is not wrapped: the author wrote it, so it is not data.
//
// Two more cases are wrapped. A frame, object or embed loads a document, so `data:` is dropped
// there except for a raster image (kind `embed`). An SVG `<animate>` or `<set>` that animates
// `href` carries the URL in `to`, `from`, `by` or `values`.
const URL_ATTRS: ReadonlySet<string> = new Set([
  'action',
  'background',
  'cite',
  'codebase',
  'data',
  'formaction',
  'href',
  'longdesc',
  'manifest',
  'ping',
  'poster',
  'profile',
  'src',
  'xlink:href',
]);

/** Tells whether an attribute name holds a URL. HTML and SVG names are compared in lower case. */
export function isUrlAttr(name: string): boolean {
  return URL_ATTRS.has(name.toLowerCase());
}

/** `url` drops script schemes. `embed` drops `data:` too, except a raster image. */
export type UrlKind = 'url' | 'embed';

const EMBED_ATTRS: ReadonlyMap<string, string> = new Map([
  ['iframe', 'src'],
  ['embed', 'src'],
  ['object', 'data'],
]);
const ANIMATED_VALUES: ReadonlySet<string> = new Set(['to', 'from', 'by', 'values']);

/**
 * Tells how a bound attribute of an element is checked, or `undefined` when it is not a URL.
 * `target` is the `attributeName` of an `<animate>` or `<set>`: its static text, `null` when it
 * is bound (so any value may be a URL), `undefined` when the element has none.
 */
export function getUrlKind(
  tag: string,
  name: string,
  target: string | null | undefined,
): UrlKind | undefined {
  const lower = name.toLowerCase();
  if ((tag === 'animate' || tag === 'set') && ANIMATED_VALUES.has(lower)) {
    if (target === undefined) {
      return undefined;
    }
    return target === null || isUrlAttr(target.trim()) ? 'url' : undefined;
  }
  if (EMBED_ATTRS.get(tag) === lower) {
    return 'embed';
  }
  return isUrlAttr(lower) ? 'url' : undefined;
}
