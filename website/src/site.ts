import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontMatter } from './front-matter.ts';
import type { FrontMatter } from './front-matter.ts';
import { createRenderer } from './markdown.ts';
import type { Heading, RenderEnv } from './markdown.ts';
import benchmarks from './benchmarks.json' with { type: 'json' };
import { DEMO_DATA } from './demo/data.ts';
import type { DemoData } from './demo/data.ts';
import { isBenchmarks } from './landing/benchmarks.ts';
import type { Benchmarks } from './landing/benchmarks.ts';
import { renderLanding } from './landing/index.ts';
import { renderPage } from './layout.ts';
import { getSampleLink } from './repl/files.ts';
import { renderRepl } from './repl/page.ts';
import { parseFence, wrapFragment } from './samples.ts';
import { buildSearchIndex } from './search/index.ts';

/** The file of the search index in the built site. */
const SEARCH_INDEX = 'search-index.json';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

export interface Page extends FrontMatter {
  /** The path of the Markdown file inside `docs`, such as `guide/state.md`. */
  file: string;
  /** The address of the page, relative to the base: `docs/guide/state/`. */
  url: string;
  html: string;
  headings: Heading[];
  description: string;
}

export interface NavSection {
  name: string;
  pages: Page[];
}

/** Every Markdown file under a folder, as paths relative to it, in a stable order. */
function listMarkdown(folder: string, prefix = ''): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(path.join(folder, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listMarkdown(folder, relative));
    } else if (entry.name.endsWith('.md')) {
      files.push(relative);
    }
  }
  return files.toSorted();
}

/** The address of a Markdown file: `docs/` for `index.md`, `docs/a/b/` for `a/b.md`. */
export function pageUrl(file: string): string {
  const name = file.slice(0, -'.md'.length);
  if (name === 'index') {
    return 'docs/';
  }
  return name.endsWith('/index') ? `docs/${name.slice(0, -'index'.length)}` : `docs/${name}/`;
}

/** The file the REPL reads the docs samples from, by the id in an "Open in REPL" link. */
const REPL_SAMPLES = 'repl/samples.json';

/**
 * Reads and renders every page under `docs`. `samples` gets the source of each code block that
 * `check:samples` compiles, by the id its "Open in REPL" link names, such as `views-3`.
 */
export function loadPages(folder = DOCS, base = '/', samples = new Map<string, string>()): Page[] {
  // The id of a sample is its page and its place among the page's samples.
  let page = '';
  let count = 0;
  function linkSample(info: string, code: string): string | undefined {
    const { lang, flags } = parseFence(info);
    if (lang !== 'tsx' || flags.has('no-check')) {
      return undefined;
    }
    count += 1;
    const id = `${page}-${count}`;
    samples.set(id, flags.has('fragment') ? wrapFragment(code) : code);
    return getSampleLink(base, id);
  }
  const renderer = createRenderer({ sampleLink: linkSample });
  const pages: Page[] = [];
  for (const file of listMarkdown(folder)) {
    page = file.slice(0, -'.md'.length).replaceAll('/', '-');
    count = 0;
    const { data, body } = splitFrontMatter(readFileSync(path.join(folder, file), 'utf8'), file);
    const env: RenderEnv = {
      headings: [],
      lead: '',
      link: (href) => resolveLink(href, file, base),
    };
    const html = renderer.render(body, env);
    pages.push({
      ...data,
      file,
      url: pageUrl(file),
      html,
      headings: env.headings,
      description: data.description ?? env.lead,
    });
  }
  return pages;
}

/** A link to another Markdown file becomes the address of its page. Other links stay as they are. */
function resolveLink(href: string, from: string, base: string): string {
  const match = /^([^#?]*\.md)(#.*)?$/.exec(href);
  if (!match) {
    return href.startsWith('/') ? base + href.slice(1) : href;
  }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), match[1]));
  return `${base}${pageUrl(target)}${match[2]}`;
}

/** The sidebar: sections by their first page, pages by `order` and then by title. */
export function buildNav(pages: readonly Page[]): NavSection[] {
  const sections = new Map<string, Page[]>();
  for (const page of pages) {
    const list = sections.get(page.section) ?? [];
    list.push(page);
    sections.set(page.section, list);
  }
  const nav: NavSection[] = [];
  for (const [name, list] of sections) {
    list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    nav.push({ name, pages: list });
  }
  nav.sort((a, b) => a.pages[0].order - b.pages[0].order || a.name.localeCompare(b.name));
  return nav;
}

/**
 * Renders the whole site by output path: one page per Markdown file, and the landing page when
 * the demo build is given.
 */
export function renderSite(
  pages: readonly Page[],
  base = '/',
  demo?: DemoData,
): Map<string, string> {
  const nav = buildNav(pages);
  const flat: Page[] = [];
  for (const section of nav) {
    flat.push(...section.pages);
  }
  const files = new Map<string, string>();
  for (const [index, page] of flat.entries()) {
    files.set(
      `${page.url}index.html`,
      renderPage({ page, nav, base, previous: flat[index - 1], next: flat[index + 1] }),
    );
  }
  if (demo === undefined) {
    return files;
  }
  files.set('repl/index.html', renderRepl({ base, start: flat[0]?.url ?? 'docs/' }));
  files.set(
    'index.html',
    renderLanding({
      base,
      start: flat[0]?.url ?? 'docs/',
      pages,
      demo,
      benchmarks: readBenchmarks(),
    }),
  );
  return files;
}

function readBenchmarks(): Benchmarks {
  if (!isBenchmarks(benchmarks)) {
    throw new TypeError('src/benchmarks.json does not have the fields the landing page reads');
  }
  return benchmarks;
}

function isDemoData(value: unknown): value is DemoData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'frame') === 'string' &&
    Array.isArray(Reflect.get(value, 'chunks'))
  );
}

/** Reads the demo build. The landing page is not written without it. */
export function readDemo(file = DEMO_DATA): DemoData {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is missing. The Vite build of the site writes it: run it first.`, {
      cause: error,
    });
  }
  if (!isDemoData(value)) {
    throw new TypeError(`${file} is not a demo build`);
  }
  return value;
}

/** Writes the pages into a folder. The Vite build has already put the assets and the demo there. */
export function writeSite(outDir: string, base = '/'): string[] {
  const samples = new Map<string, string>();
  const pages = loadPages(DOCS, base, samples);
  const files = renderSite(pages, base, readDemo());
  for (const [name, html] of files) {
    const target = path.join(outDir, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, html);
  }
  // The command bar fetches the index the first time it opens. The entries follow the sidebar.
  const ordered: Page[] = [];
  for (const section of buildNav(pages)) {
    ordered.push(...section.pages);
  }
  writeFileSync(path.join(outDir, SEARCH_INDEX), JSON.stringify(buildSearchIndex(ordered)));
  writeFileSync(path.join(outDir, REPL_SAMPLES), JSON.stringify(Object.fromEntries(samples)));
  return [...files.keys()];
}
