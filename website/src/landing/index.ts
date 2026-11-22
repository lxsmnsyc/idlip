// The landing page: the hero, the resume diagram, the benefit cards, the benchmarks, the sample,
// the objections and the final call to action, in that order.
import type { DemoData } from '../demo/data.ts';
import { ICON, REPOSITORY, escape, renderFooter, renderHead, renderHeader } from '../layout.ts';
import { renderLiveSample } from '../live/markup.ts';
import { PROPS_FILE } from '../repl/files.ts';
import type { ReplFile } from '../repl/files.ts';
import type { Page } from '../site.ts';
import { renderBenchmarks } from './benchmarks.ts';
import type { Benchmarks, Sizes } from './benchmarks.ts';
import { renderFeatures } from './features.ts';
import { formatBytes } from './format.ts';
import { renderHeroStage } from './hero.ts';
import { renderInstall } from './install.ts';
import { renderResume } from './resume.ts';
import { SAMPLE_FILE, SAMPLE_SOURCE } from './sample.ts';

/**
 * The gzip -9 size of the loader with every optional feature flag of `vite/features.ts` on and
 * `skew` on. Measured by bundling `idlip/client` with the flags defined as `true`. With none on
 * and `skew` off the loader is the demo's own, so the demo build supplies the smallest size.
 */
const LOADER_MAX_GZIP = 7336;

/** The loader range and the inline listener, as the copy shows them. */
function readSizes(demo: DemoData): Sizes {
  return {
    loaderMin: formatBytes(demo.loader.gzip),
    loaderMax: formatBytes(LOADER_MAX_GZIP),
    listener: formatBytes(demo.listener.gzip),
  };
}

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

function renderHero(base: string, start: string, demo: DemoData): string {
  return `<section class="tile tile-ink hero">
  <div class="hero-copy">
    <h1 class="display">Only the code you <em>click</em> loads.</h1>
    <p class="lead">idlip is a UI framework for server-rendered apps. No component code runs on load.</p>
    ${renderInstall('hero')}
    <div class="actions">
      <a class="button primary" href="${base}${start}">Read the guide${ICON.arrow}</a>
    </div>
  </div>
  ${renderHeroStage(demo)}
</section>`;
}

/** The files of the landing sample: the counter and the props it starts from. */
const SAMPLE_FILES: ReplFile[] = [
  { name: SAMPLE_FILE, source: SAMPLE_SOURCE },
  { name: PROPS_FILE, source: '{\n  "start": 0\n}\n' },
];

/**
 * The smallest working code beside the chunks of the todo demo above, as a live sample that runs
 * and takes edits. It has no REPL button: the landing page sends no one to the REPL.
 */
function renderSample(demo: DemoData): string {
  const rest = demo.chunks.length - 2;
  return `<section aria-labelledby="sample-title">
  <h2 class="row-title" id="sample-title">The code <code>${escape(SAMPLE_FILE)}</code></h2>
  <div class="landing-sample sample">
    <div class="tile tile-code">${renderLiveSample(SAMPLE_FILES)}</div>
    <div class="tile chunks-tile">
      <p class="chunks-title">What the todo demo loads</p>
      <ul class="chunks">
        <li><code>${escape(demo.loader.name)}</code><span>${formatBytes(demo.loader.gzip)}, with the page</span></li>
        <li><code>inline listener</code><span>${formatBytes(demo.listener.gzip)}, in the HTML</span></li>
        <li><code>${escape(demo.handler.name)}</code><span>${formatBytes(demo.handler.gzip)}, first click</span></li>
        <li><code>${escape(demo.binding.name)}</code><span>${formatBytes(demo.binding.gzip)}, same click</span></li>
        <li><code>${rest} more chunks</code><span>One per event</span></li>
      </ul>
      <p class="chunks-foot">Sizes are gzip.</p>
    </div>
  </div>
</section>`;
}

/** Facts that stop a visitor from starting. Every line is in the docs or the package. */
const FACTS: { term: string; text: string }[] = [
  { term: 'License', text: 'MIT' },
  { term: 'Version', text: '0.x, not on npm before 0.1' },
  { term: 'Runtime', text: 'Node 22+, Vite 7+' },
  { term: 'Language', text: 'TypeScript, TSX' },
];

function renderFacts(): string {
  let items = '';
  for (const item of FACTS) {
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
  <div class="final-copy">
    ${renderInstall('final')}
    <div class="actions">
      <a class="button primary" href="${base}${start}">Read the guide${ICON.arrow}</a>
    </div>
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
  const description = 'A UI framework that resumes in the browser where the server stopped.';
  return `<!doctype html>
<html lang="en">
${renderHead(base, 'idlip', description, true)}
<body>
<a class="skip" href="#content">Skip to the content</a>
${renderHeader(base, start)}
<main id="content" class="landing">
  ${renderHero(base, start, demo)}
  ${renderResume(demo)}
  ${renderFeatures(pages, base)}
  ${renderBenchmarks(benchmarks, findBenchmarksLink(pages, base, benchmarks.source), readSizes(demo))}
  ${renderSample(demo)}
  ${renderFacts()}
  ${renderFinal(base, start)}
</main>
${renderFooter()}
</body>
</html>
`;
}
