import MarkdownIt from 'markdown-it';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLiveSamples, renderLiveSamples } from '../src/live/check.ts';
import type { PageSample } from '../src/live/check.ts';
import { findLiveSamples, nameEntry, parseLiveInfo } from '../src/live/fence.ts';
import { renderLiveSample } from '../src/live/markup.ts';
import { createRenderer } from '../src/markdown.ts';
import type { RenderEnv } from '../src/markdown.ts';
import { decodeFiles } from '../src/repl/files.ts';
import { loadPages } from '../src/site.ts';

const parser = new MarkdownIt();

/** Lets pending promises and timers run. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

const COUNTER = `export default function Counter() {
  let count = 0;
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}
`;

/** The text of some HTML, as `textContent` reads it. */
function readText(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function renderMarkdown(markdown: string, link?: string): string {
  const renderer = createRenderer({ liveLink: () => link });
  const env: RenderEnv = { headings: [], lead: '', link: (href) => href };
  return renderer.render(markdown, env);
}

describe('live fences', () => {
  it('reads the live tag and the file name', () => {
    expect(parseLiveInfo('tsx live')).toEqual({ lang: 'tsx', name: undefined });
    expect(parseLiveInfo(' tsx live counter.tsx ')).toEqual({ lang: 'tsx', name: 'counter.tsx' });
    expect(parseLiveInfo('json live props.json')).toEqual({ lang: 'json', name: 'props.json' });
    expect(parseLiveInfo('tsx')).toBeUndefined();
    expect(parseLiveInfo('tsx no-check')).toBeUndefined();
    expect(parseLiveInfo('tsx fragment')).toBeUndefined();
    expect(parseLiveInfo('ts live')).toBeUndefined();
    expect(parseLiveInfo('tsx live a.tsx extra')).toBeUndefined();
  });

  it('names the first file by its default export', () => {
    expect(nameEntry(COUNTER)).toBe('counter.tsx');
    expect(nameEntry('export default function TodoApp() {}')).toBe('todo-app.tsx');
    expect(nameEntry('export default function () {}')).toBe('app.tsx');
  });

  it('joins named fences right after a sample, and starts a sample after other content', () => {
    const markdown = [
      '```tsx live',
      COUNTER,
      '```',
      '```tsx live part.tsx',
      'export default function Part() { return <p>Part</p>; }',
      '```',
      '```json live props.json',
      '{"start": 1}',
      '```',
      '',
      'Some text.',
      '',
      '```tsx live',
      COUNTER,
      '```',
      '```tsx live',
      COUNTER,
      '```',
      '```tsx live alone.tsx',
      COUNTER,
      '```',
    ].join('\n');
    const samples = findLiveSamples(parser.parse(markdown, {}));
    const names: string[][] = [];
    for (const sample of samples) {
      names.push(sample.files.map((file) => file.name));
    }
    expect(names).toEqual([
      ['counter.tsx', 'part.tsx', 'props.json'],
      ['counter.tsx'],
      ['counter.tsx', 'alone.tsx'],
    ]);
    expect(samples[0].line).toBe(1);
    expect(samples[0].files[2].source).toBe('{"start": 1}\n');
  });

  it('rejects a bad name, a duplicate name and a sample that starts with props', () => {
    const parse = (markdown: string): unknown =>
      findLiveSamples(parser.parse(markdown, {}), 'docs/x.md');
    expect(() => parse('```json live props.json\n{}\n```\n')).toThrow(
      'docs/x.md:1: a live sample starts with a tsx fence.',
    );
    expect(() => parse('```tsx live\na\n```\n```tsx live a.ts\nb\n```\n')).toThrow('a.ts');
    expect(() => parse('```tsx live\na\n```\n```json live data.json\n{}\n```\n')).toThrow(
      'Name it props.json',
    );
    expect(() => parse('```tsx live a.tsx\na\n```\n```tsx live a.tsx\nb\n```\n')).toThrow(
      'two files named a.tsx',
    );
  });
});

describe('live markup', () => {
  it('shows the highlighted code of each file with no script', () => {
    const files = [
      { name: 'counter.tsx', source: COUNTER },
      { name: 'props.json', source: '{ "a": "<b>&" }\n' },
    ];
    const html = renderLiveSample(files, { repl: '/repl/#sample=x-1' });
    expect(html).toContain('data-live-sample ');
    expect(html).toContain('class="tok ');
    // The text of each source block is the source and one newline, which the editor reads.
    const blocks = [...html.matchAll(/<pre[^>]*data-live-source="([^"]+)">([\s\S]*?)<\/pre>/g)];
    expect(blocks.map((block) => block[1])).toEqual(['counter.tsx', 'props.json']);
    expect(readText(blocks[0][2])).toBe(`${COUNTER}\n`);
    expect(readText(blocks[1][2])).toBe(`${files[1].source}\n`);
    expect(html).toContain('href="/repl/#sample=x-1"');
    expect(html).toContain('aria-label="Open this code in the REPL"');
    expect(html).not.toContain('Open in REPL');
    // The output is in the markup from the start, so nothing moves when the script fills it.
    expect(html).toContain('data-live-result');
    expect(html).toContain('data-live-tab="compiled"');
  });

  it('has no REPL button without a link', () => {
    expect(renderLiveSample([{ name: 'a.tsx', source: COUNTER }])).not.toContain('data-live-repl');
  });

  it('renders the live fences of a page as one sample, and other blocks as before', () => {
    const html = renderMarkdown(
      `\`\`\`tsx live\n${COUNTER}\`\`\`\n\`\`\`json live props.json\n{}\n\`\`\`\n\n\`\`\`tsx\n${COUNTER}\`\`\`\n`,
      '/repl/#files=x',
    );
    expect(html.match(/<figure class="live"/g)).toHaveLength(1);
    expect(html.match(/data-live-file=/g)).toHaveLength(2);
    expect(html.match(/<div class="code-block">/g)).toHaveLength(1);
    expect(html).not.toContain('code-repl');
  });
});

describe('the live samples of the docs', () => {
  const samples = new Map<string, string>();
  const live: PageSample[] = [];
  const pages = loadPages(undefined, '/', samples, live);

  it('has live samples on many pages and no "Open in REPL" link', () => {
    expect(live.length).toBeGreaterThanOrEqual(40);
    const files = new Set<string>();
    for (const sample of live) {
      files.add(sample.file);
    }
    expect(files.size).toBeGreaterThanOrEqual(10);
    for (const page of pages) {
      expect(page.html, page.file).not.toContain('Open in REPL');
    }
  });

  it('compiles and renders every live sample', async () => {
    expect(checkLiveSamples(live)).toEqual([]);
    expect(await renderLiveSamples(live)).toEqual([]);
  });

  it('links a sample of several files with its files, and one file by id', () => {
    let views = '';
    for (const page of pages) {
      if (page.file === 'views.md') {
        views = page.html;
      }
    }
    const hash = /href="\/repl\/(#files=[^"]+)"/.exec(views)?.[1] ?? '';
    const files = decodeFiles(hash);
    expect(files?.map((file) => file.name)).toEqual(['profile.tsx', 'props.json']);
    expect(views).toContain('href="/repl/#sample=views-2"');
  });

  it('reports a sample that does not compile', () => {
    const broken: PageSample = {
      file: 'docs/x.md',
      files: [{ name: 'a.tsx', source: 'export default function A() { return <p>; }' }],
    };
    expect(checkLiveSamples([broken])[0]).toMatch(/^docs\/x\.md: a\.tsx:1:/);
  });
});

describe('the live script', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../src/live/sample.ts');
  });

  type Callback = (entries: { isIntersecting: boolean; target: unknown }[]) => void;

  it('loads the sample code only when a sample nears the viewport', async () => {
    class FakeElement {
      dataset: Record<string, string> = {};
    }
    const roots = [new FakeElement(), new FakeElement()];
    const callbacks: Callback[] = [];
    const options: unknown[] = [];
    const started: unknown[] = [];
    vi.stubGlobal('HTMLElement', FakeElement);
    // A constructor that returns an object: `new` yields the object, with no class methods.
    function IntersectionObserver(callback: Callback, settings: unknown): object {
      callbacks.push(callback);
      options.push(settings);
      return { observe: () => undefined, unobserve: () => undefined };
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserver);
    vi.stubGlobal('document', { querySelectorAll: () => roots });
    let imported = 0;
    vi.doMock('../src/live/sample.ts', () => {
      imported++;
      return {
        startSample: (root: unknown) => {
          started.push(root);
        },
      };
    });
    vi.resetModules();
    await import('../src/client/live.ts');
    expect(options).toEqual([{ rootMargin: '400px 0px' }]);
    await flush();
    expect(imported).toBe(0);

    callbacks[0]([{ isIntersecting: false, target: roots[0] }]);
    await flush();
    expect(imported).toBe(0);

    callbacks[0]([{ isIntersecting: true, target: roots[1] }]);
    await vi.waitFor(() => {
      expect(started).toEqual([roots[1]]);
    });
    callbacks[0]([{ isIntersecting: true, target: roots[0] }]);
    await vi.waitFor(() => {
      expect(started).toEqual([roots[1], roots[0]]);
    });
    expect(imported).toBe(1);
  });
});
