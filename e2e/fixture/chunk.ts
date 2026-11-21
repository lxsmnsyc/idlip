// A built chunk file, such as `/assets/todo.binding.todos._.done.j_y-el90.js`: the module's base
// name, the chunk kind, the chunk name with `*` written as `_`, and the build hash. The example
// sets the file names to `[name].[hash].js`, and a hash has no `.`, so it is the last segment.
// The view of a child is a facade file and the shared file that holds its code.
const BUILT_VIEW = /(?:\/[^/.]+\.view|idlip-view_lang)\.[\w-]+\.js$/;
const BUILT_CHUNK = /\/[^/.]+\.(handler|binding|list|task|source)\.(.+)\.[\w-]+\.js$/;

/**
 * Returns the chunk name in a request URL, such as `handler=toggle`, or undefined for any other URL.
 * The fixture serves `<module>?idlip-<chunk>&lang.js`. The example serves built files named
 * `<module>.<kind>.<name>.<hash>.js`, where a `_` segment of a binding path stands for `*`.
 */
export default function getChunkName(url: string): string | undefined {
  const parsed = new URL(url, 'http://localhost');
  for (const [key, value] of parsed.searchParams) {
    if (key.startsWith('idlip-')) {
      // The view chunk of a child has no name.
      return value === '' ? key.slice('idlip-'.length) : `${key.slice('idlip-'.length)}=${value}`;
    }
  }
  if (BUILT_VIEW.test(parsed.pathname)) {
    return 'view';
  }
  const built = BUILT_CHUNK.exec(parsed.pathname);
  if (built === null) {
    return undefined;
  }
  const [, kind, name] = built;
  if (kind !== 'binding') {
    return `${kind}=${name}`;
  }
  const segments: string[] = [];
  for (const segment of name.split('.')) {
    segments.push(segment === '_' ? '*' : segment);
  }
  return `${kind}=${segments.join('.')}`;
}
