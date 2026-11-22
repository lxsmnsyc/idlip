// The landing page: the hero, the resume diagram, the benefit cards, the benchmarks, the sample,
// the objections and the final call to action, in that order.
import type { DemoData } from '../demo/data.ts';
import { ICON, REPOSITORY, escape, renderFooter, renderHead, renderHeader } from '../layout.ts';
import { createRenderer } from '../markdown.ts';
import type { RenderEnv } from '../markdown.ts';
import type { Page } from '../site.ts';
import { renderBenchmarks, writeHeadline } from './benchmarks.ts';
import type { Benchmarks } from './benchmarks.ts';
import { renderFeatures } from './features.ts';
import { formatBytes } from './format.ts';
import { renderResume } from './resume.ts';
import { SAMPLE_FILE, SAMPLE_SOURCE } from './sample.ts';

const renderer = createRenderer();

/** The install command. The package is not on npm before the 0.1 release. */
export const INSTALL_COMMAND = 'pnpm add idlip';

export interface LandingContext {
  base: string;
  /** The address of the first page of the guide. */
  start: string;
  /** Every docs page, for the links of the feature grid. */
  pages: readonly Page[];
  /** The demo build. The diagram and the sample notes read its names and sizes. */
  demo: DemoData;
  benchmarks: Benchmarks;
}

/** The install command with its copy button. */
function renderInstall(): string {
  return `<div class="install"><code>${escape(INSTALL_COMMAND)}</code><button class="code-copy" type="button" data-copy="${escape(INSTALL_COMMAND)}" aria-label="Copy the install command">Copy</button></div>`;
}

function renderHero(base: string, start: string, benchmarks: Benchmarks): string {
  const headline = writeHeadline(benchmarks);
  const conditions =
    headline.conditions === ''
      ? ''
      : `<p class="hero-note">${escape(headline.conditions)} <a href="#benchmarks">Benchmarks</a></p>`;
  return `<section class="tile tile-ink hero">
  <h1 class="display">${escape(headline.before)}<em>${escape(headline.value)}</em>${escape(headline.after)}</h1>
  <div>
    <p class="lead">Server renders, browser resumes. A UI framework for TypeScript. A click loads one handler and the bindings it changed.</p>
    <div class="actions">
      <a class="button primary" href="${base}${start}">Read the guide${ICON.arrow}</a>
      ${renderInstall()}
    </div>
    ${conditions}
  </div>
</section>`;
}

/**
 * The smallest working code beside the chunks of the todo demo above. The container is
 * `.landing-sample`: a later live editor replaces its content and takes the source from
 * `SAMPLE_SOURCE`.
 */
function renderSample(demo: DemoData): string {
  const env: RenderEnv = { headings: [], lead: '', link: (href) => href };
  const code = renderer.render(`\`\`\`tsx no-check\n${SAMPLE_SOURCE}\`\`\`\n`, env);
  const rest = demo.chunks.length - 2;
  const before = demo.loader.gzip + demo.listener.gzip;
  return `<section aria-labelledby="sample-title">
  <h2 class="row-title" id="sample-title">The code <code>${escape(SAMPLE_FILE)}</code></h2>
  <div class="landing-sample sample">
    <div class="tile tile-code">${code}</div>
    <div class="tile chunks-tile">
      <p class="chunks-title">What the todo demo loads</p>
      <ul class="chunks">
        <li><code>${escape(demo.loader.name)}</code><span>${formatBytes(demo.loader.gzip)}, loads with the page</span></li>
        <li><code>inline listener</code><span>${formatBytes(demo.listener.gzip)}, in the HTML, so ${formatBytes(before)} before the page is ready</span></li>
        <li><code>${escape(demo.handler.name)}</code><span>${formatBytes(demo.handler.gzip)}, the first click on a checkbox</span></li>
        <li><code>${escape(demo.binding.name)}</code><span>${formatBytes(demo.binding.gzip)}, the same click</span></li>
        <li><code>${rest} more chunks</code><span>The event that needs each one</span></li>
      </ul>
      <p class="chunks-foot">The chart above measures the benchmark dashboard, a different app, so its number differs. Sizes are gzip -9.</p>
    </div>
  </div>
</section>`;
}

/** Facts that stop a visitor from starting. Every line is in the docs or the package. */
const OBJECTIONS: { term: string; text: string }[] = [
  { term: 'License', text: 'MIT.' },
  {
    term: 'Maturity',
    text: 'Pre-release, version 0.x. The package is not on npm before the 0.1 release, and the API can change between 0.x versions.',
  },
  { term: 'Runtime', text: 'Node 22 or later. The Vite plugin needs Vite 7 or later.' },
  { term: 'Language', text: 'TypeScript. Views are TSX function components.' },
  {
    term: 'Browsers',
    text: 'The docs do not list supported browsers yet.',
  },
];

function renderObjections(): string {
  let items = '';
  for (const item of OBJECTIONS) {
    items += `<div><dt>${escape(item.term)}</dt><dd>${escape(item.text)}</dd></div>`;
  }
  return `<section aria-labelledby="facts-title">
  <h2 class="row-title" id="facts-title">Before you start</h2>
  <dl class="tile facts">${items}</dl>
</section>`;
}

function renderFinal(base: string, start: string): string {
  return `<section class="tile tile-ink final" aria-labelledby="final-title">
  <h2 class="display" id="final-title">Start with one command.</h2>
  <div>
    <div class="actions">
      <a class="button primary" href="${base}${start}">Read the guide${ICON.arrow}</a>
      ${renderInstall()}
    </div>
    <p class="hero-note">MIT license. <a href="${REPOSITORY}" target="_blank" rel="noreferrer">Source on GitHub</a></p>
  </div>
</section>`;
}

/** The address of the benchmarks page, or of the results in the repo until the page exists. */
function findBenchmarksLink(pages: readonly Page[], base: string, source: string): string {
  for (const page of pages) {
    if (page.file === 'benchmarks.md' || page.file.endsWith('/benchmarks.md')) {
      return `${base}${page.url}`;
    }
  }
  return `${REPOSITORY}/blob/main/${source}`;
}

export function renderLanding(context: LandingContext): string {
  const { base, start, pages, demo, benchmarks } = context;
  const description =
    'A UI framework that resumes in the browser where the server stopped.';
  return `<!doctype html>
<html lang="en">
${renderHead(base, 'idlip', description, true)}
<body>
<a class="skip" href="#content">Skip to the content</a>
${renderHeader(base, start)}
<main id="content" class="landing">
  ${renderHero(base, start, benchmarks)}
  ${renderResume(demo)}
  ${renderFeatures(pages, base)}
  ${renderBenchmarks(benchmarks, findBenchmarksLink(pages, base, benchmarks.source))}
  ${renderSample(demo)}
  ${renderObjections()}
  ${renderFinal(base, start)}
</main>
${renderFooter()}
</body>
</html>
`;
}
