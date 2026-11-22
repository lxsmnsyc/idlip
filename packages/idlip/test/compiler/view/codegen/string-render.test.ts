// Every client body clones a template: the only markup a chunk parses in the browser is the
// value of `html=`. This test compiles every component of the fixtures, the differential
// subjects, the examples and the benchmark apps, as a root and as a child, and reads each render
// function of each chunk through its syntax tree.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { listCompiled } from '../../../../src/core/format.ts';

const PACKAGE = join(import.meta.dirname, '..', '..', '..', '..');
const REPO = join(PACKAGE, '..', '..');
const FOLDERS = [
  join(PACKAGE, 'test', 'fixtures'),
  join(PACKAGE, 'test', 'differential', 'subjects'),
  join(REPO, 'examples'),
  join(REPO, 'benchmarks', 'idlip'),
];

/** The helpers that build HTML strings: only the server module uses them. */
const STRING_HELPERS = new Set(['text$', 'attr$', 'on$']);

/** The functions of a chunk that render nodes. */
const RENDER_NAME = /^(?:render|region|renderC\d+)$/;

type AstNode = Record<string, unknown> & { type: string; start: number; end: number };

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

/**
 * Calls `visit` on every node below `node`, parents first, with the nodes above it. `visit`
 * returns false to skip the children.
 */
function walk(
  node: unknown,
  visit: (node: AstNode, ancestors: readonly AstNode[]) => boolean,
  ancestors: AstNode[] = [],
): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visit, ancestors);
    }
    return;
  }
  if (!isNode(node) || !visit(node, ancestors)) {
    return;
  }
  ancestors.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'type' && key !== 'start' && key !== 'end') {
      walk(value, visit, ancestors);
    }
  }
  ancestors.pop();
}

/** The text of a template literal part. */
function getCooked(node: AstNode): string {
  return String(Reflect.get(Object(node.value), 'cooked') ?? '');
}

/** Returns the text of every string literal and template part below a node. */
function listStrings(node: unknown): string[] {
  const strings: string[] = [];
  walk(node, (item) => {
    if (item.type === 'Literal' && typeof item.value === 'string') {
      strings.push(item.value);
    } else if (item.type === 'TemplateElement') {
      strings.push(getCooked(item));
    }
    return true;
  });
  return strings;
}

function hasMarkup(text: string): boolean {
  return /<[a-zA-Z!/]/.test(text);
}

/** The strings with markup that the source writes inside `html={...}`, which raw HTML may hold. */
function listRawStrings(source: string): Set<string> {
  const raw = new Set<string>();
  walk(parseSync('source.tsx', source).program, (node) => {
    const name = node.name;
    if (node.type === 'JSXAttribute' && isNode(name) && name.name === 'html') {
      for (const text of listStrings(node.value)) {
        if (hasMarkup(text)) {
          raw.add(text);
        }
      }
    }
    return true;
  });
  return raw;
}

function getSource(node: AstNode, code: string): string {
  return code.slice(node.start, node.end);
}

/**
 * Tells whether a call is the parse of an `html=` value: the spread argument of `.append` on a
 * cloned node or of `el.replaceChildren`, with the generated value, `(value) ?? ''`, or that
 * value with the parser's first newline dropped.
 */
function isRawParse(call: AstNode, parent: AstNode | undefined, code: string): boolean {
  const args = Array.isArray(call.arguments) ? call.arguments : [];
  const value = isNode(args[1]) ? getSource(args[1], code) : '';
  const shape = /^\(.*\) \?\? ''$|^String\(\(\(.*\) \?\? ''\)\)\.replace\(\/\^\\n\/, ''\)$/s;
  const callee = isNode(parent) && isNode(parent.callee) ? getSource(parent.callee, code) : '';
  return shape.test(value) && /^(?:\$n\d*\[\d+\]\.append|el\.replaceChildren)$/.test(callee);
}

/** Returns what a chunk does that is a string render, one line per finding. */
function findStringRenders(code: string, raw: ReadonlySet<string>): string[] {
  const found: string[] = [];
  const body: unknown = parseSync('chunk.js', code).program.body;
  for (const statement of Array.isArray(body) ? body : []) {
    if (!isNode(statement)) {
      continue;
    }
    // A string helper imported from the shared module.
    if (statement.type === 'ImportDeclaration' && isNode(statement.source)) {
      if (statement.source.value === 'idlip/helpers') {
        for (const specifier of Array.isArray(statement.specifiers) ? statement.specifiers : []) {
          const local =
            isNode(specifier) && isNode(specifier.local) ? String(specifier.local.name) : '';
          if (STRING_HELPERS.has(local)) {
            found.push(`imports ${local}`);
          }
        }
      }
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (
      !isNode(declaration) ||
      declaration.type !== 'FunctionDeclaration' ||
      !isNode(declaration.id)
    ) {
      continue;
    }
    const name = String(declaration.id.name);
    if (RENDER_NAME.test(name)) {
      found.push(...checkRender(name, declaration, code, raw));
    }
  }
  return found;
}

/**
 * Checks one render function: every `return` gives a clone (`<fragment>[0]`) or an empty
 * fragment, no string with markup appears outside an `html=` value, and every parse is one.
 */
function checkRender(name: string, fn: AstNode, code: string, raw: ReadonlySet<string>): string[] {
  const found: string[] = [];
  walk(fn.body, (node, ancestors) => {
    if (node.type === 'ReturnStatement') {
      const argument = isNode(node.argument) ? getSource(node.argument, code) : '';
      if (
        !/^(?:\$n\d*|clone\$\(\w+\$, \$doc\))\[0\]$|^\$doc\.createDocumentFragment\(\)$/.test(
          argument,
        )
      ) {
        found.push(`${name} returns ${argument}`);
      }
    }
    if (node.type === 'CallExpression' && isNode(node.callee) && node.callee.name === 'parseHtml') {
      // The parse is the spread argument of the call two levels up.
      const parent = ancestors.at(-2);
      if (isRawParse(node, parent, code)) {
        // Inside an `html=` value, a markup string must come from the source's `html=`.
        for (const text of listStrings(node)) {
          if (hasMarkup(text) && !raw.has(text)) {
            found.push(`${name} parses ${JSON.stringify(text)}`);
          }
        }
        return false;
      }
      found.push(`${name} parses ${getSource(node, code)}`);
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && node.value.includes('<')) {
      found.push(`${name} writes ${JSON.stringify(node.value)}`);
    }
    if (node.type === 'TemplateElement' && getCooked(node).includes('<')) {
      found.push(`${name} writes ${getSource(node, code)}`);
    }
    return true;
  });
  return found;
}

function listSources(folder: string, files: string[]): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'expected') {
        listSources(path, files);
      }
    } else if (entry.name.endsWith('.tsx')) {
      files.push(path);
    }
  }
}

interface Chunk {
  readonly name: string;
  readonly code: string;
  readonly raw: ReadonlySet<string>;
}

/** Compiles a file as a root and as a child, and returns the chunks of every component. */
function compileChunks(path: string): Chunk[] {
  const source = readFileSync(path, 'utf8');
  const id = `/src/${relative(REPO, path).replaceAll('/', '_')}`;
  const raw = listRawStrings(source);
  const chunks: Chunk[] = [];
  for (const child of [false, true]) {
    const result = compile(source, id, { child });
    let failed = false;
    for (const diagnostic of result.diagnostics) {
      failed ||= diagnostic.severity === 'error';
    }
    if (failed) {
      continue;
    }
    for (const component of listCompiled(result)) {
      for (const module of component.client) {
        chunks.push({ name: `${relative(REPO, path)} ${module.chunk}`, code: module.code, raw });
      }
    }
  }
  return chunks;
}

/** Chunks of string renders, each of which the test must flag. */
const STRING_RENDERS: readonly (readonly [string, string])[] = [
  [
    'an HTML helper',
    "import { attr$, on$, text$ } from 'idlip/helpers';\nexport function render() {}",
  ],
  [
    'a static branch returned as HTML',
    "function renderC2(branch, $doc) {\nif (branch === 0) {\nreturn clone$(templateC2_0$, $doc)[0];\n}\nreturn '<i></i>';\n}",
  ],
  [
    'markup built from parts',
    "function renderC2(branch, $doc) {\nif (branch === 0) {\nreturn clone$(templateC2_0$, $doc)[0];\n}\nconst $n = clone$(templateC2_1$, $doc);\n$n[1].append(...parseHtml($doc, '<' + 'i></i>'));\nreturn $n[0];\n}",
  ],
  [
    'a row parsed from HTML',
    'export function render(scope, $doc) {\nconst nodes = parseHtml($doc, `<!--i-->${scope.html}<!--/i-->`);\nreturn nodes[0];\n}',
  ],
  [
    'a raw parse of markup the source does not hold',
    "export function render(scope, $doc) {\nconst $n = clone$(templateL1$, $doc);\n$n[1].append(...parseHtml($doc, (`<b>${scope.x}</b>`) ?? ''));\nreturn $n[0];\n}",
  ],
];

describe('client chunks', () => {
  it.each(STRING_RENDERS)('flag %s', (_name, code) => {
    expect(findStringRenders(code, new Set())).not.toEqual([]);
  });

  it('allow a parse of an html= value with the markup of the source', () => {
    const code =
      "export function render(scope, $doc) {\nconst $n = clone$(templateL1$, $doc);\n$n[1].append(...parseHtml($doc, (`<b>${scope.x}</b>`) ?? ''));\nreturn $n[0];\n}";
    expect(findStringRenders(code, new Set(['<b>', '</b>']))).toEqual([]);
  });

  const files: string[] = [];
  for (const folder of FOLDERS) {
    listSources(folder, files);
  }
  const chunks: Chunk[] = [];
  for (const file of files) {
    chunks.push(...compileChunks(file));
  }

  it('compile from every fixture, subject, example and benchmark app', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(chunks.length).toBeGreaterThan(300);
  });

  it('parse only the content of raw HTML in the browser, and render every body by a clone', () => {
    const found: string[] = [];
    let raw = 0;
    for (const chunk of chunks) {
      for (const finding of findStringRenders(chunk.code, chunk.raw)) {
        found.push(`${chunk.name}: ${finding}`);
      }
      raw += chunk.code.includes('...parseHtml(') ? 1 : 0;
    }
    expect(found).toEqual([]);
    // The fixtures hold raw HTML, so the allowed form is met.
    expect(raw).toBeGreaterThan(3);
  });
});
