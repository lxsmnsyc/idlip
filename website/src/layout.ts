import { readFileSync } from 'node:fs';
import { createRenderer } from './markdown.ts';
import type { RenderEnv } from './markdown.ts';
import type { NavSection, Page } from './site.ts';

const REPOSITORY = 'https://github.com/lxsmnsyc/idlip';

const renderer = createRenderer();
const escape = renderer.utils.escapeHtml;

/** The `:root { ... }` block of a syntax theme, which holds its colors. */
function readColors(file: string): string {
  const css = readFileSync(new URL(import.meta.resolve(file)), 'utf8');
  const start = css.indexOf(':root');
  return css.slice(css.indexOf('{', start), css.indexOf('}', start) + 1);
}

// The comments of the light theme are darker than GitHub's, so they reach 4.5:1 on the code panel.
const light = readColors('@twinkleplop/theme-github/light').replace(
  /--twp-comment:\s*#6e7781/,
  '--twp-comment: #59636e',
);
const dark = readColors('@twinkleplop/theme-github/dark');

/** The colors of code in both themes, inlined so a page paints highlighted before any file loads. */
const SYNTAX = `<style>:root${light}:root[data-theme='dark']${dark}@media (prefers-color-scheme: dark){:root:not([data-theme='light'])${dark}}</style>`;

/** Sets the saved theme before the first paint, so a page never flashes the other one. */
const THEME_SCRIPT = `<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch{}</script>`;

const ICON = {
  sun: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
};

/** The header, the same on every page. */
function renderHeader(base: string, start: string): string {
  return `<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${base}">idlip</a>
    <nav class="header-nav" aria-label="Site">
      <a href="${base}${start}">Docs</a>
      <a class="icon-link" href="${REPOSITORY}" target="_blank" rel="noreferrer" aria-label="GitHub">${ICON.github}</a>
      <button class="theme-toggle" type="button" aria-label="Switch the theme"><span class="icon-sun">${ICON.sun}</span><span class="icon-moon">${ICON.moon}</span></button>
    </nav>
  </div>
</header>`;
}

function renderHead(base: string, title: string, description: string): string {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${THEME_SCRIPT}
${SYNTAX}
<link rel="stylesheet" href="${base}assets/site.css">
<script type="module" src="${base}assets/site.js"></script>
</head>`;
}

export interface PageContext {
  page: Page;
  nav: NavSection[];
  base: string;
  previous?: Page | undefined;
  next?: Page | undefined;
}

/** The sidebar: a group per section, the current page marked. */
function renderSidebar(nav: NavSection[], current: Page, base: string): string {
  let groups = '';
  for (const section of nav) {
    let items = '';
    for (const item of section.pages) {
      const here = item === current ? ' aria-current="page"' : '';
      items += `<li><a href="${base}${item.url}"${here}>${escape(item.title)}</a></li>`;
    }
    groups += `<div class="nav-group"><p class="nav-title">${escape(section.name)}</p><ul>${items}</ul></div>`;
  }
  return `<nav class="sidebar" aria-label="Documentation">${groups}</nav>`;
}

/** The table of contents: the `h2` and `h3` headings of the page. */
function renderContents(page: Page): string {
  let items = '';
  for (const heading of page.headings) {
    if (heading.level === 2 || heading.level === 3) {
      items += `<li class="level-${heading.level}"><a href="#${escape(heading.id)}">${escape(heading.text)}</a></li>`;
    }
  }
  return items === ''
    ? ''
    : `<nav class="toc" aria-label="On this page"><p class="nav-title">On this page</p><ul>${items}</ul></nav>`;
}

function renderPager(base: string, previous?: Page, next?: Page): string {
  const back = previous
    ? `<a class="pager-link prev" href="${base}${previous.url}" rel="prev"><span>Previous</span>${escape(previous.title)}</a>`
    : '<span></span>';
  const forward = next
    ? `<a class="pager-link next" href="${base}${next.url}" rel="next"><span>Next</span>${escape(next.title)}</a>`
    : '<span></span>';
  return `<nav class="pager" aria-label="Pages">${back}${forward}</nav>`;
}

/** One documentation page. */
export function renderPage({ page, nav, base, previous, next }: PageContext): string {
  const start = nav[0]?.pages[0]?.url ?? 'docs/';
  return `<!doctype html>
<html lang="en">
${renderHead(base, `${page.title} - idlip`, page.description)}
<body>
<a class="skip" href="#content">Skip to the content</a>
${renderHeader(base, start)}
<div class="docs-layout">
  ${renderSidebar(nav, page, base)}
  <main id="content" class="prose">
    <p class="eyebrow">${escape(page.section)}</p>
    <h1>${escape(page.title)}</h1>
${page.html}
    ${renderPager(base, previous, next)}
  </main>
  ${renderContents(page)}
</div>
</body>
</html>
`;
}

export interface LandingContext {
  base: string;
  /** The source of the todo example, shown highlighted. Empty for none. */
  example: string;
  /** The address of the first page of the guide. */
  start: string;
}

/** The landing page: the claim, a link to the guide and the todo example. */
export function renderLanding({ base, example, start }: LandingContext): string {
  let sample = '';
  if (example !== '') {
    const env: RenderEnv = { headings: [], lead: '', link: (href) => href };
    sample = `<section class="landing-sample">
  <p class="eyebrow">examples/todo</p>
  ${renderer.render(`\`\`\`tsx no-check\n${example}\`\`\`\n`, env)}
</section>`;
  }
  return `<!doctype html>
<html lang="en">
${renderHead(base, 'idlip', 'A UI framework that resumes in the browser where the server stopped.')}
<body>
<a class="skip" href="#content">Skip to the content</a>
${renderHeader(base, start)}
<main id="content" class="landing">
  <section class="hero">
    <p class="eyebrow">Resumable UI</p>
    <h1 class="display">The server rendered it. The browser <em>resumes</em> it.</h1>
    <p class="lead">No view code runs on load. A click loads one update handler and only the bindings whose model paths changed.</p>
    <p class="actions">
      <a class="button primary" href="${base}${start}">Read the guide<svg class="icon-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <a class="button" href="${REPOSITORY}" target="_blank" rel="noreferrer">GitHub</a>
    </p>
  </section>
  ${sample}
</main>
</body>
</html>
`;
}
