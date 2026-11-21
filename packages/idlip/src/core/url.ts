// The attributes that hold a URL. The compiler wraps a bound value of each one in `safeUrl`
// (`helpers.ts`), which drops a `javascript:` or `vbscript:` URL. A static value written in
// source is not wrapped: the author wrote it, so it is not data.
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
// oxlint-disable-next-line import/prefer-default-export
export function isUrlAttr(name: string): boolean {
  return URL_ATTRS.has(name.toLowerCase());
}
