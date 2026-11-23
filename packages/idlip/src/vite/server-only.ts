import { readFileSync } from 'node:fs';
import { parseSync } from 'oxc-parser';

/** The `import.meta.env` keys that Vite sets itself, so they are not private. */
const BUILT_IN_ENV = new Set(['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL']);

/** The id prefix that Vite gives a Node.js built-in it cannot run in the browser. */
export const BROWSER_EXTERNAL = '__vite-browser-external';

/** A file the walk reads: scripts only, so a stylesheet or an image is not parsed. */
const SCRIPT = /\.[cm]?[jt]sx?$/;

/** The call that stands for a private `import.meta.env` read in a build. */
export const PRIVATE_ENV = '__idlip_private_env__';

const PRIVATE_READ = new RegExp(`${PRIVATE_ENV}\\(("(?:[^"\\\\]|\\\\.)*")\\)`);

/** The key of the first marked private read in the code of a chunk, or undefined. */
export function findPrivateRead(code: string): string | undefined {
  const match = PRIVATE_READ.exec(code);
  return match === null ? undefined : String(JSON.parse(match[1]));
}

/** What one module imports and which `import.meta.env` keys it reads. */
export interface ModuleScan {
  /** The specifiers of its imports, in source order. */
  imports: string[];
  /** The keys read as `import.meta.env.KEY`, in source order. */
  keys: string[];
  /** The same reads with the offsets of the member expression. */
  reads: { key: string; start: number; end: number }[];
}

/** Where a check looks for the import graph: resolving a specifier and reading a file. */
export interface ServerOnlyHost {
  /** The file that a specifier names from an importer, or undefined when it is not a file. */
  resolve(specifier: string, importer: string): Promise<string | undefined>;
  /** The source of a file. */
  read(file: string): string;
}

/** What the check knows about the chunk. */
export interface ServerOnlyChunk {
  /** The source file of the component. */
  file: string;
  /** The chunk's name, such as `handler=toggle`. */
  chunk: string;
  /** The code of the chunk. */
  code: string;
  /** The names a label shows: the component's module id. */
  label: string;
  /** The `envPrefix` of Vite: the keys that start with it reach the browser. */
  prefixes: readonly string[];
}

/** The scans of the files that earlier checks read, by file, kept while the source is the same. */
export type ScanCache = Map<string, { source: string; scan: ModuleScan }>;

/**
 * Whether a specifier names a Node.js module for certain: `node:fs`. A bare `fs` is one only when
 * Vite resolves it to its browser-external stub, since `events` or `buffer` may be an npm package.
 */
export function isNodeSpecifier(specifier: string): boolean {
  return specifier.startsWith('node:');
}

/** Whether a resolved id is the stub that Vite gives a Node.js built-in in the browser. */
export function isBrowserExternal(id: string): boolean {
  return id.includes(BROWSER_EXTERNAL);
}

/**
 * Whether the browser can read an `import.meta.env` key: Vite's own keys, and the keys that start
 * with one of the prefixes.
 */
export function isPublicKey(key: string, prefixes: readonly string[]): boolean {
  if (BUILT_IN_ENV.has(key)) {
    return true;
  }
  for (const prefix of prefixes) {
    if (prefix !== '' && key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The string value of a literal node, or undefined. */
function readLiteral(node: unknown): string | undefined {
  if (isRecord(node) && node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  return undefined;
}

/** Whether a node is `import.meta.env`. */
function isMetaEnv(node: unknown): boolean {
  if (!isRecord(node) || node.type !== 'MemberExpression' || node.computed === true) {
    return false;
  }
  const { object, property } = node;
  return (
    isRecord(object) &&
    object.type === 'MetaProperty' &&
    isRecord(property) &&
    property.type === 'Identifier' &&
    property.name === 'env'
  );
}

/** The key that a member expression reads from `import.meta.env`, or undefined. */
function readEnvKey(node: Record<string, unknown>): string | undefined {
  if (node.type !== 'MemberExpression' || !isMetaEnv(node.object)) {
    return undefined;
  }
  const { property } = node;
  if (node.computed !== true) {
    return isRecord(property) && property.type === 'Identifier' ? String(property.name) : undefined;
  }
  return readLiteral(property);
}

/** Whether every specifier of an import declaration is inline `type`, which leaves no import. */
function isTypeOnly(node: Record<string, unknown>): boolean {
  const specifiers = node.specifiers;
  if (!Array.isArray(specifiers) || specifiers.length === 0) {
    return false;
  }
  for (const specifier of specifiers) {
    if (!isRecord(specifier) || specifier.importKind !== 'type') {
      return false;
    }
  }
  return true;
}

/**
 * Reads the imports and the `import.meta.env` keys of a module. A type-only import and a type-only
 * export are not imports, since they leave no code.
 */
export function scanModule(file: string, source: string): ModuleScan {
  const scan: ModuleScan = { imports: [], keys: [], reads: [] };
  const stack: unknown[] = [parseSync(file, source).program];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      // Pushed in reverse, so the scan reads in source order.
      for (let index = node.length - 1; index >= 0; index--) {
        stack.push(node[index]);
      }
      continue;
    }
    if (!isRecord(node)) {
      continue;
    }
    const type = node.type;
    if (type === 'ImportDeclaration' || type === 'ExportAllDeclaration') {
      const specifier = readLiteral(node.source);
      const kind = type === 'ImportDeclaration' ? node.importKind : node.exportKind;
      if (specifier !== undefined && kind !== 'type' && !isTypeOnly(node)) {
        scan.imports.push(specifier);
      }
    } else if (type === 'ExportNamedDeclaration' && node.source !== null) {
      const specifier = readLiteral(node.source);
      if (specifier !== undefined && node.exportKind !== 'type') {
        scan.imports.push(specifier);
      }
    } else if (type === 'ImportExpression') {
      const specifier = readLiteral(node.source);
      if (specifier !== undefined) {
        scan.imports.push(specifier);
      }
    } else {
      const key = readEnvKey(node);
      if (key !== undefined && typeof node.start === 'number' && typeof node.end === 'number') {
        scan.keys.push(key);
        scan.reads.push({ key, start: node.start, end: node.end });
      }
    }
    // A type annotation holds no code, so the walk skips it.
    const children: unknown[] = [];
    for (const [name, child] of Object.entries(node)) {
      if (name !== 'typeAnnotation' && name !== 'returnType' && typeof child === 'object') {
        children.push(child);
      }
    }
    stack.push(...children.toReversed());
  }
  return scan;
}

/** Whether the walk reads a specifier: the runtime of idlip is not user code. */
function isRuntime(specifier: string): boolean {
  return specifier === 'idlip' || specifier.startsWith('idlip/');
}

/** Whether the walk reads a resolved file. */
function isWalked(file: string): boolean {
  return (
    !file.startsWith('\0') &&
    !file.includes('?') &&
    !file.includes('/node_modules/') &&
    SCRIPT.test(file)
  );
}

/** The advice that ends the error of a Node.js import. */
export const ADVICE =
  'The browser cannot run it. Move the code that needs it to where the server renders and pass the result in as a prop, or use a package that runs in the browser.';

/** The error of a client chunk that reaches a Node.js module. */
export function printNodeError(where: string, chain: readonly string[]): string {
  return `idlip: ${where} imports a Node.js module: ${printChain(chain)}. ${ADVICE}`;
}

/** The error of a client chunk that reads a private `import.meta.env` key. */
export function printEnvError(
  where: string,
  key: string,
  chain: readonly string[],
  prefixes: readonly string[],
): string {
  const shown = [];
  for (const prefix of prefixes) {
    if (prefix !== '') {
      shown.push(`${prefix}*`);
    }
  }
  return `idlip: ${where} reads import.meta.env.${key}, which is undefined in the browser: ${printChain(chain)}. Only ${shown.join(', ')}, MODE, DEV, PROD, SSR and BASE_URL reach the browser. Read it where the server renders and pass the value in as a prop.`;
}

/** Prints a chain of names, from the component to the cause. */
export function printChain(names: readonly string[]): string {
  return names.join(' > ');
}

/**
 * Fails when the import graph of a client chunk reaches a Node.js module, or when the chunk or a
 * module it imports reads an `import.meta.env` key that the browser does not get. The error names
 * the chain: the component, the chunk, then each import down to the cause. Only your own files
 * are read: a package under `node_modules` and the runtime of idlip are not.
 */
export async function checkServerOnly(
  host: ServerOnlyHost,
  chunk: ServerOnlyChunk,
  cache: ScanCache = new Map(),
  name: (file: string) => string = String,
): Promise<void> {
  const start = [chunk.label, chunk.chunk];
  const where = `the client chunk ${chunk.chunk} of ${chunk.label}`;
  const seen = new Set<string>();

  async function visit(file: string, scan: ModuleScan, chain: string[]): Promise<void> {
    // The keys come first, since a module reads them without importing anything.
    for (const key of scan.keys) {
      if (!isPublicKey(key, chunk.prefixes)) {
        throw new Error(printEnvError(where, key, chain, chunk.prefixes));
      }
    }
    for (const specifier of scan.imports) {
      if (isNodeSpecifier(specifier)) {
        throw new Error(printNodeError(where, [...chain, specifier]));
      }
      if (isRuntime(specifier)) {
        continue;
      }
      const target = await host.resolve(specifier, file);
      if (target !== undefined && isBrowserExternal(target)) {
        throw new Error(printNodeError(where, [...chain, specifier]));
      }
      if (target === undefined || seen.has(target) || !isWalked(target)) {
        continue;
      }
      seen.add(target);
      const source = host.read(target);
      let cached = cache.get(target);
      if (cached === undefined || cached.source !== source) {
        cached = { source, scan: scanModule(target, source) };
        cache.set(target, cached);
      }
      await visit(target, cached.scan, [...chain, name(target)]);
    }
  }

  seen.add(chunk.file);
  await visit(chunk.file, scanModule('chunk.js', chunk.code), start);
}

/** Reads a file from the disk. */
export function readSource(file: string): string {
  return readFileSync(file, 'utf8');
}
