// oxlint-disable no-console
// Compares each reference page with the built declarations of its subpath: every export needs a
// `### \`name\`` heading on the page, and every such heading must name an export.
// Run `pnpm --filter idlip build` first.
import { readFileSync } from 'node:fs';

const packageDir = new URL('../../../packages/idlip/', import.meta.url);
const referenceDir = new URL('../../docs/reference/', import.meta.url);

/** The page of each subpath, by the key of `package.json` `exports`. */
const PAGES = new Map([
  ['.', 'idlip.md'],
  ['./server', 'server.md'],
  ['./client', 'client.md'],
  ['./compiler', 'compiler.md'],
  ['./vite', 'vite.md'],
  ['./testing', 'testing.md'],
  ['./jsx-runtime', 'jsx-runtime.md'],
]);

const HEADING = /^### `([^`]+)`/gm;
// tsdown writes `export declare ...` statements and `export { ... }` lists, which may rename a
// local with `as`.
const DECLARATION =
  /^export (?:declare )?(?:abstract )?(?:function|const enum|const|let|var|class|interface|type|namespace|enum) ([A-Za-z_$][\w$]*)/gm;
const LIST = /^export (?:type )?\{([^}]*)\}(?! from)/gm;
// Forms the check cannot read. A declaration file that uses one fails the check.
const UNREAD = /^export (?:default |\*|(?:type )?\{[^}]*\} from)/m;

/** Reads the `types` file of each subpath from `package.json`. `undefined` means not a string. */
function readSubpaths(): Map<string, string | undefined> {
  const manifest: unknown = JSON.parse(readFileSync(new URL('package.json', packageDir), 'utf8'));
  const exports: unknown = Reflect.get(Object(manifest), 'exports');
  const subpaths = new Map<string, string | undefined>();
  if (typeof exports !== 'object' || exports === null) {
    return subpaths;
  }
  for (const key of Object.keys(exports)) {
    const value: unknown = Reflect.get(exports, key);
    if (typeof value === 'string') {
      // A plain path such as `./package.json` has no types.
      continue;
    }
    const types: unknown = Reflect.get(Object(value), 'types');
    subpaths.set(key, typeof types === 'string' ? types : undefined);
  }
  return subpaths;
}

/** Lists the names a declaration file exports. */
function listExports(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(DECLARATION)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(LIST)) {
    for (const part of match[1].split(',')) {
      const item = part.trim().replace(/^type /, '');
      if (item === '') {
        continue;
      }
      const renamed = / as ([\w$]+)$/.exec(item);
      names.add(renamed === null ? item : renamed[1]);
    }
  }
  return names;
}

/** Lists the names that a page documents with a `### \`name\`` heading. */
function listHeadings(markdown: string): Set<string> {
  const names = new Set<string>();
  for (const match of markdown.matchAll(HEADING)) {
    names.add(match[1]);
  }
  return names;
}

let problems = 0;
let checked = 0;

for (const [subpath, types] of readSubpaths()) {
  const page = PAGES.get(subpath);
  if (page === undefined) {
    problems++;
    console.error(`${subpath}: no reference page is mapped`);
    continue;
  }
  if (types === undefined) {
    problems++;
    console.error(`${subpath}: \`types\` is not a plain path`);
    continue;
  }
  const declarations = readFileSync(new URL(types, packageDir), 'utf8');
  if (UNREAD.test(declarations)) {
    problems++;
    console.error(`${types}: has a default export or a re-export, which the check cannot read`);
    continue;
  }
  const exported = listExports(declarations);
  const documented = listHeadings(readFileSync(new URL(page, referenceDir), 'utf8'));
  for (const name of exported) {
    checked++;
    if (!documented.has(name)) {
      problems++;
      console.error(`reference/${page}: ${name} is exported but has no heading`);
    }
  }
  for (const name of documented) {
    if (!exported.has(name)) {
      problems++;
      console.error(`reference/${page}: ${name} has a heading but is not exported`);
    }
  }
}

console.log(`${checked} exports, ${problems} problems`);
process.exitCode = problems > 0 ? 1 : 0;
