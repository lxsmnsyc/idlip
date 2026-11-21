/**
 * Returns the chunk name in a request URL, such as `handler=toggle`, or undefined for any other URL.
 * The fixture serves `<module>?idlip-<chunk>&lang.js`. `example-todo` changes this function if the
 * built files are named another way.
 */
export default function getChunkName(url: string): string | undefined {
  for (const [key, value] of new URL(url, 'http://localhost').searchParams) {
    if (key.startsWith('idlip-')) {
      return `${key.slice('idlip-'.length)}=${value}`;
    }
  }
  return undefined;
}
