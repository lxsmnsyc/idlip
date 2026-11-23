// The files of a REPL session and the hash of its address. A hash names a built-in example
// (`#example=counter`), a docs sample by id (`#sample=views-3`), or holds the files themselves
// (`#files=...`). Only the first two can run on open: their code comes from the site, not from
// the link. The site build writes the sample links, so this file runs in Node and in the browser.

export interface ReplFile {
  /** A file name with no folder, such as `counter.tsx` or `props.json`. */
  name: string;
  source: string;
}

/** The file that holds the props of the first component. */
export const PROPS_FILE = 'props.json';

/** The hash prefix of a share link. */
const HASH_PREFIX = '#files=';
const EXAMPLE_PREFIX = '#example=';
const SAMPLE_PREFIX = '#sample=';

/** What the hash of the REPL address names. */
export type ReplHash =
  | { kind: 'none' }
  | { kind: 'example'; id: string }
  | { kind: 'sample'; id: string }
  | { kind: 'files'; files: ReplFile[] };

/** A file name the REPL takes: letters, digits, `.`, `-` and `_`, ending in `.tsx`. */
export function isModuleName(name: string): boolean {
  return /^[\w-]+(?:\.[\w-]+)*\.tsx$/.test(name);
}

function encodeBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(text: string): string {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function isReplFile(value: unknown): value is ReplFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'name') === 'string' &&
    typeof Reflect.get(value, 'source') === 'string'
  );
}

/** The hash of a share link: the files as JSON of `[name, source]` pairs, in base64url. */
export function encodeFiles(files: readonly ReplFile[]): string {
  const pairs: [string, string][] = [];
  for (const file of files) {
    pairs.push([file.name, file.source]);
  }
  return `${HASH_PREFIX}${encodeBase64Url(JSON.stringify(pairs))}`;
}

/** The files of a share link hash, or `undefined` when the hash holds none or is broken. */
export function decodeFiles(hash: string): ReplFile[] | undefined {
  if (!hash.startsWith(HASH_PREFIX)) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(decodeBase64Url(hash.slice(HASH_PREFIX.length)));
  } catch {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const files: ReplFile[] = [];
  const names = new Set<string>();
  for (const pair of value as unknown[]) {
    const file: unknown = Array.isArray(pair)
      ? { name: pair.at(0) as unknown, source: pair.at(1) as unknown }
      : undefined;
    // Two files with one name would make the tabs and the imports ambiguous.
    if (!isReplFile(file) || names.has(file.name)) {
      return undefined;
    }
    names.add(file.name);
    files.push(file);
  }
  return files.length > 0 ? files : undefined;
}

/** Reads the hash of the REPL address. A broken `#files=` hash reads as none. */
export function readHash(hash: string): ReplHash {
  if (hash.startsWith(EXAMPLE_PREFIX)) {
    return { kind: 'example', id: decodeURIComponent(hash.slice(EXAMPLE_PREFIX.length)) };
  }
  if (hash.startsWith(SAMPLE_PREFIX)) {
    return { kind: 'sample', id: decodeURIComponent(hash.slice(SAMPLE_PREFIX.length)) };
  }
  const files = decodeFiles(hash);
  return files === undefined ? { kind: 'none' } : { kind: 'files', files };
}

export function getExampleHash(id: string): string {
  return `${EXAMPLE_PREFIX}${encodeURIComponent(id)}`;
}

export function getSampleHash(id: string): string {
  return `${SAMPLE_PREFIX}${encodeURIComponent(id)}`;
}

/** The address of the REPL with a docs sample, from the base of the site and the sample id. */
export function getSampleLink(base: string, id: string): string {
  return `${base}repl/${getSampleHash(id)}`;
}

/** The files of a docs sample: the sample as the page, and empty props. */
export function getSampleFiles(source: string): ReplFile[] {
  return [
    { name: 'app.tsx', source },
    { name: PROPS_FILE, source: '{}\n' },
  ];
}
