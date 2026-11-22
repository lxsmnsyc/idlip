// Every client body clones a template: the only markup a chunk parses in the browser is the
// value of `html=`. This test compiles every component of the fixtures, the differential
// subjects, the examples and the benchmark apps, as a root and as a child, and reads the chunks.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
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
const STRING_HELPERS = /\b(?:text|attr|on)\$(?![\w$])/;

/** A string or template literal that starts with a tag or a comment. */
const MARKUP = /[`'"]<[a-zA-Z!/]/;

/** Lines of chunks from before this change, each a string render the test must find. */
const OLD_LINES = [
  "import { attr$, on$, text$ } from 'idlip/helpers';",
  "return branch === 0 ? '<span>even</span>' : '';",
  'const nodes = parseHtml(start.ownerDocument, `<!--i-->${html}<!--/i-->`);',
];

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
}

/** Compiles a file as a root and as a child, and returns the chunks of every component. */
function compileChunks(path: string): Chunk[] {
  const source = readFileSync(path, 'utf8');
  const id = `/src/${relative(REPO, path).replaceAll('/', '_')}`;
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
        chunks.push({ name: `${relative(REPO, path)} ${module.chunk}`, code: module.code });
      }
    }
  }
  return chunks;
}

/**
 * Returns the places where a chunk parses markup other than an `html=` value: an import of a
 * string helper, a parse that is not raw content, and markup in a string inside a render
 * function. `inRender` starts the scan inside one, for a single line.
 */
function findStringRenders(code: string, inRender = false): string[] {
  const found: string[] = [];
  let render = inRender;
  for (const line of code.split('\n')) {
    // A function body ends at a `}` in the first column. Model data and handlers may hold
    // markup strings that `html=` renders, so only render functions are read for markup.
    if (/^(?:export )?function /.test(line)) {
      render = /^(?:export )?function (?:render|region|renderC\d+)\(/.test(line);
    } else if (line === '}') {
      render = false;
    }
    if (line.startsWith('import ') && line.includes("from 'idlip/helpers'")) {
      if (STRING_HELPERS.test(line)) {
        found.push(line);
      }
      continue;
    }
    // `html=` content: the binding replaces the element's children, a clone appends them.
    const parses = line.split('parseHtml(').length - 1;
    const raw = (line.match(/\.(?:replaceChildren|append)\(\.\.\.parseHtml\(/g) ?? []).length;
    if (line.includes('parseHtml(') && !line.startsWith('import ') && parses !== raw) {
      found.push(line);
    }
    // Markup in a string, outside the template declarations and the `html=` values.
    if (render && !line.includes('parseHtml(') && MARKUP.test(line)) {
      found.push(line);
    }
  }
  return found;
}

describe('client chunks', () => {
  it('finds the string renders of the chunks from before every body cloned', () => {
    for (const line of OLD_LINES) {
      expect(findStringRenders(line, true), line).toEqual([line]);
    }
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

  it('parse only the content of raw HTML in the browser', () => {
    const found: string[] = [];
    let raw = 0;
    for (const chunk of chunks) {
      for (const line of findStringRenders(chunk.code)) {
        found.push(`${chunk.name}: ${line}`);
      }
      raw += chunk.code.includes('...parseHtml(') ? 1 : 0;
    }
    expect(found).toEqual([]);
    // The fixtures hold raw HTML, so the allowed form is met.
    expect(raw).toBeGreaterThan(3);
  });

  it('render rows, branches, views and catch views by a clone', () => {
    const missing: string[] = [];
    for (const chunk of chunks) {
      if (/^export function (?:render|region)\(|^function renderC\d+\(/m.test(chunk.code)) {
        if (!chunk.code.includes('clone$(') && !chunk.code.includes('createDocumentFragment()')) {
          missing.push(chunk.name);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
