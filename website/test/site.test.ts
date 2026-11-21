import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitFrontMatter } from '../src/front-matter.ts';
import { checkMarkdown, extractSamples } from '../src/samples.ts';
import { buildNav, loadPages, pageUrl, renderSite } from '../src/site.ts';

/** A docs folder with the given files, which hold `[title, order, section]` and a body. */
function makeDocs(files: Record<string, [string, number, string]>): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'idlip-docs-'));
  for (const [file, [title, order, section]] of Object.entries(files)) {
    const target = path.join(folder, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      `---\ntitle: ${title}\norder: ${order}\nsection: ${section}\n---\n\nBody of ${title}.\n\n## Part\n\nText.\n`,
    );
  }
  return folder;
}

describe('pages', () => {
  it('renders a page per Markdown file, plus the landing page', () => {
    const folder = makeDocs({
      'index.md': ['Start', 0, 'Start'],
      'a.md': ['A', 1, 'Guide'],
      'deep/b.md': ['B', 2, 'Guide'],
    });
    const files = renderSite(loadPages(folder));
    expect([...files.keys()].toSorted()).toEqual([
      'docs/a/index.html',
      'docs/deep/b/index.html',
      'docs/index.html',
      'index.html',
    ]);
    expect(files.get('docs/a/index.html')).toContain('<h1>A</h1>');
  });

  it('orders the sidebar by order, and sections by their first page', () => {
    const folder = makeDocs({
      'z.md': ['Zed', 1, 'Guide'],
      'a.md': ['Ay', 2, 'Guide'],
      'ref.md': ['Ref', 0, 'Reference'],
      'x.md': ['Ex', 5, 'Reference'],
    });
    const nav = buildNav(loadPages(folder));
    expect(nav.map((section) => section.name)).toEqual(['Reference', 'Guide']);
    expect(nav[1].pages.map((page) => page.title)).toEqual(['Zed', 'Ay']);
  });

  it('links previous and next pages in sidebar order and marks the current page', () => {
    const folder = makeDocs({
      'one.md': ['One', 1, 'Guide'],
      'two.md': ['Two', 2, 'Guide'],
      'three.md': ['Three', 3, 'Guide'],
    });
    const html = renderSite(loadPages(folder)).get('docs/two/index.html')!;
    expect(html).toContain('rel="prev"');
    expect(html).toContain('href="/docs/one/"');
    expect(html).toContain('href="/docs/three/"');
    expect(html).toContain('aria-current="page"');
  });

  it('turns links to Markdown files into page addresses', () => {
    const folder = makeDocs({ 'a.md': ['A', 1, 'Guide'], 'deep/b.md': ['B', 2, 'Guide'] });
    writeFileSync(
      path.join(folder, 'a.md'),
      '---\ntitle: A\norder: 1\nsection: Guide\n---\n\n[b](./deep/b.md#part)\n',
    );
    const html = renderSite(loadPages(folder, '/idlip/'), '/idlip/').get('docs/a/index.html')!;
    expect(html).toContain('href="/idlip/docs/deep/b/#part"');
  });

  it('maps files to addresses', () => {
    expect(pageUrl('index.md')).toBe('docs/');
    expect(pageUrl('a/b.md')).toBe('docs/a/b/');
    expect(pageUrl('a/index.md')).toBe('docs/a/');
  });

  it('rejects a page without the front matter fields', () => {
    expect(() => splitFrontMatter('# No front matter\n', 'x.md')).toThrow(/front matter/);
    expect(() => splitFrontMatter('---\ntitle: T\n---\n', 'x.md')).toThrow(/order/);
  });
});

describe('the built docs', () => {
  it('has the placeholder page', () => {
    const source = readFileSync(new URL('../docs/index.md', import.meta.url), 'utf8');
    expect(splitFrontMatter(source, 'index.md').data.title).toBe('Introduction');
  });
});

describe('sample checker', () => {
  const view =
    'export default function A() {\n  let n = 0;\n  function inc() {\n    n = n + 1;\n  }\n  return <button on:click={() => inc()}>{n}</button>;\n}\n';

  it('accepts a valid block, a fragment and a skipped block', () => {
    const markdown = [
      '```tsx',
      view,
      '```',
      '',
      '```tsx fragment',
      '<ul><li>one</li></ul>',
      '```',
      '',
      '```tsx no-check',
      'this is not code <<<',
      '```',
    ].join('\n');
    expect(extractSamples(markdown)).toHaveLength(2);
    expect(checkMarkdown(markdown, 'ok.md')).toEqual([]);
  });

  it('fails on a view the analyzer rejects', () => {
    // A closure in a model value does not resume.
    const broken = [
      '```tsx',
      'export default function A() {',
      '  let f = () => 1;',
      '  return <p>{f}</p>;',
      '}',
      '```',
    ].join('\n');
    const problems = checkMarkdown(broken, 'bad.md');
    expect(problems[0]).toMatchObject({ file: 'bad.md', line: 1 });
    expect(problems[0]?.message).toMatch(/^error hole-closure:/);
  });

  it('fails on a fragment with an unknown hole', () => {
    const broken = '```tsx fragment\n<p>{...spread}</p>\n```\n';
    expect(checkMarkdown(broken, 'hole.md').length).toBeGreaterThan(0);
  });
});
