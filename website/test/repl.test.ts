import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { listChunks } from '../src/repl/chunks.ts';
import { EXAMPLES } from '../src/repl/examples.ts';
import {
  decodeFiles,
  encodeFiles,
  getExampleHash,
  getSampleLink,
  readHash,
} from '../src/repl/files.ts';
import { renderRepl } from '../src/repl/page.ts';
import { compileProject } from '../src/repl/project.ts';
import { createDataUrl, renderProject } from '../src/repl/render.ts';
import { loadPages } from '../src/site.ts';

const FOLDER = 'https://site.test/assets/repl-run/1/';
const RUNTIME = 'https://site.test/assets/repl-runtime.js';

describe('repl examples', () => {
  for (const example of EXAMPLES) {
    it(`compiles and renders ${example.id}`, async () => {
      const project = compileProject(example.files);
      expect(project.problems).toEqual([]);
      expect(project.ok).toBe(true);
      const chunks = listChunks(project, FOLDER, RUNTIME);
      expect(chunks.length).toBeGreaterThan(0);
      const served = new Set([RUNTIME]);
      for (const chunk of chunks) {
        served.add(`${FOLDER}${chunk.path}`);
      }
      // Every import points at the runtime or at another chunk of the run.
      for (const chunk of chunks) {
        for (const match of chunk.code.matchAll(/\bfrom\s*'([^']+)'/g)) {
          expect(served).toContain(match[1]);
        }
      }
      const rendered = await renderProject(project, chunks, FOLDER, createDataUrl);
      expect(rendered.body).toContain('<script i-state');
      // The state names the chunks by the URLs of the run.
      expect(rendered.body).toContain(FOLDER);
      expect(rendered.body).not.toContain('&lang.js\\":\\"/src/');
    });
  }
});

describe('share links', () => {
  it('round-trips the files, with text outside ASCII', () => {
    const files = [
      {
        name: 'a.tsx',
        source: 'export default function A() {\n  return <p>héllo ✓</p>;\n}\n',
      },
      { name: 'props.json', source: '{"x": 1}' },
    ];
    expect(decodeFiles(encodeFiles(files))).toEqual(files);
  });

  it('rejects a broken hash and duplicate names', () => {
    expect(decodeFiles('#files=%%%')).toBeUndefined();
    expect(decodeFiles('#other')).toBeUndefined();
    expect(decodeFiles(encodeFiles([]))).toBeUndefined();
    const twice = { name: 'a.tsx', source: '' };
    expect(decodeFiles(encodeFiles([twice, twice]))).toBeUndefined();
    expect(readHash('#files=%%%')).toEqual({ kind: 'none' });
  });

  it('names examples and docs samples by id, never by code', () => {
    expect(readHash(getExampleHash('todo'))).toEqual({ kind: 'example', id: 'todo' });
    const link = getSampleLink('/base/', 'views-3');
    expect(link).toBe('/base/repl/#sample=views-3');
    expect(readHash(link.slice(link.indexOf('#')))).toEqual({ kind: 'sample', id: 'views-3' });
    const files = [{ name: 'a.tsx', source: 'x' }];
    expect(readHash(encodeFiles(files))).toEqual({ kind: 'files', files });
  });

  it('collects the docs samples that the links name', () => {
    const samples = new Map<string, string>();
    const pages = loadPages(undefined, '/', samples);
    expect(samples.size).toBeGreaterThan(40);
    let views = '';
    for (const page of pages) {
      if (page.file === 'views.md') {
        views = page.html;
      }
    }
    expect(views).toContain('href="/repl/#sample=views-1"');
    expect(samples.get('views-1')).toContain('export default function');
  });
});

describe('problems', () => {
  it('shows a syntax error with its position', () => {
    const project = compileProject([
      {
        name: 'a.tsx',
        source: 'export default function A() {\n  let x = ;\n  return <p>{x}</p>;\n}\n',
      },
    ]);
    expect(project.ok).toBe(false);
    expect(project.problems[0]).toMatchObject({ file: 'a.tsx', severity: 'error', line: 2 });
  });

  it('reports a child that is not a file', () => {
    const nesting = EXAMPLES[EXAMPLES.length - 1];
    expect(nesting.id).toBe('nesting');
    const project = compileProject([nesting.files[0]]);
    expect(project.ok).toBe(false);
    expect(project.problems[0]).toMatchObject({ file: 'board.tsx', rule: 'repl-import' });
  });

  it('reports broken props', () => {
    const project = compileProject([
      EXAMPLES[0].files[0],
      { name: 'props.json', source: '{ start: 0 }' },
    ]);
    expect(project.problems[0]).toMatchObject({ file: 'props.json', rule: 'props-json' });
  });
});

describe('dependencies', () => {
  it('pins the wasm parser to the oxc-parser version that idlip uses', () => {
    const website: unknown = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const binding: unknown = Reflect.get(
      Object(Reflect.get(Object(website), 'dependencies')),
      '@oxc-parser/binding-wasm32-wasi',
    );
    const idlip = createRequire(createRequire(import.meta.url).resolve('idlip/package.json'));
    const parser: unknown = JSON.parse(
      readFileSync(idlip.resolve('oxc-parser/package.json'), 'utf8'),
    );
    expect(binding).toBe(Reflect.get(Object(parser), 'version'));
  });
});

describe('repl page', () => {
  it('renders the shell, which only the site script loads', () => {
    const html = renderRepl({ base: '/', start: 'docs/' });
    expect(html).toContain('data-repl');
    expect(html).toContain('<title>REPL - idlip</title>');
    expect(html).toContain('<a href="/repl/" aria-current="page">REPL</a>');
    // The frame styles hold the site tokens.
    expect(html).toContain('--accent-fill');
    const scripts: string[] = [];
    for (const match of html.matchAll(/<script[^>]*src="([^"]+)"/g)) {
      scripts.push(match[1]);
    }
    expect(scripts).toEqual(['/assets/site.js']);
  });
});
