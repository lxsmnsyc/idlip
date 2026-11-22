import { createRenderer } from './markdown.ts';
import type { NavSection, Page } from './site.ts';

export const REPOSITORY = 'https://github.com/lxsmnsyc/idlip';

const renderer = createRenderer();

/** Escapes text for HTML. */
export const escape = renderer.utils.escapeHtml;

/** Sets the saved theme before the first paint, so a page never flashes the other one. */
const THEME_SCRIPT = `<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch{}</script>`;

/** The icons of the site: one set, 24px grid, 1.8px stroke. */
export const ICON = {
  sun: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  arrow:
    '<svg class="icon-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  reload:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  even: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 9h14M5 15h14"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plug: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  pointer:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="var(--bg-elevated)" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l14 7.5-6.2 1.6L10 18z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  open: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
};

/**
 * The links of the header after the search slot. `website-repl` adds its link here.
 * `wide` links hide on narrow screens.
 */
export const HEADER_LINKS: {
  label: string;
  href: (base: string, start: string) => string;
  wide?: boolean;
}[] = [
  { label: 'Docs', href: (base, start) => `${base}${start}` },
  { label: 'Benchmarks', href: (base) => `${base}#benchmarks`, wide: true },
];

/** The header, the same on every page. `.header-slot` is empty until `website-search` fills it. */
export function renderHeader(base: string, start: string): string {
  let links = '';
  for (const link of HEADER_LINKS) {
    const wide = link.wide === true ? ' class="nav-wide"' : '';
    links += `<a${wide} href="${link.href(base, start)}">${escape(link.label)}</a>`;
  }
  return `<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${base}">idlip</a>
    <div class="header-slot"></div>
    <nav class="header-nav" aria-label="Site">
      ${links}
      <a class="icon-button" href="${REPOSITORY}" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">${ICON.github}</a>
      <button class="icon-button theme-toggle" type="button" aria-label="Switch the theme" title="Switch the theme"><span class="icon-sun">${ICON.sun}</span><span class="icon-moon">${ICON.moon}</span></button>
    </nav>
  </div>
</header>`;
}

/** The `<head>` of every page: the theme script, the stylesheet, the one script and the fonts. */
export function renderHead(base: string, title: string, description: string): string {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${THEME_SCRIPT}
<link rel="preload" href="${base}fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/site.css">
<script type="module" src="${base}assets/site.js"></script>
</head>`;
}

/** The footer of every page. */
export function renderFooter(): string {
  return `<footer class="site-footer"><span>idlip</span><a href="${REPOSITORY}" target="_blank" rel="noreferrer">MIT license, on GitHub</a></footer>`;
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
    <p class="crumb">${escape(page.section)}</p>
    <h1>${escape(page.title)}</h1>
${page.html}
    ${renderPager(base, previous, next)}
  </main>
  ${renderContents(page)}
</div>
${renderFooter()}
</body>
</html>
`;
}
