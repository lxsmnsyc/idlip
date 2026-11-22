// The landing page: the hero, the resume diagram, the feature grid, the benchmarks and the todo
// sample, in that order.
import type { DemoData } from '../demo/data.ts';
import { ICON, REPOSITORY, escape, renderFooter, renderHead, renderHeader } from '../layout.ts';
import { createRenderer } from '../markdown.ts';
import type { RenderEnv } from '../markdown.ts';
import type { Page } from '../site.ts';
import { renderBenchmarks } from './benchmarks.ts';
import type { Benchmarks } from './benchmarks.ts';
import { renderFeatures } from './features.ts';
import { formatBytes } from './format.ts';
import { renderResume } from './resume.ts';

const renderer = createRenderer();

export interface LandingContext {
  base: string;
  /** The address of the first page of the guide. */
  start: string;
  /** Every docs page, for the links of the feature grid. */
  pages: readonly Page[];
  /** The source of the todo example, shown highlighted. Empty for none. */
  example: string;
  /** The demo build. The diagram and the sample notes read its names and sizes. */
  demo: DemoData;
  benchmarks: Benchmarks;
}

function renderHero(base: string, start: string): string {
  return `<section class="tile tile-ink hero">
  <h1 class="display">Server renders.<br>Browser <em>resumes.</em></h1>
  <div>
    <p class="lead">A UI framework for TypeScript. No view code runs on load. A click loads one handler and the bindings it changed.</p>
    <p class="actions">
      <a class="button primary" href="${base}${start}">Read the guide${ICON.arrow}</a>
      <a class="button" href="${REPOSITORY}" target="_blank" rel="noreferrer">GitHub</a>
    </p>
  </div>
</section>`;
}

/** The source of the example beside the chunks it builds into and when each one loads. */
function renderSample(example: string, demo: DemoData): string {
  if (example === '') {
    return '';
  }
  const env: RenderEnv = { headings: [], lead: '', link: (href) => href };
  const code = renderer.render(`\`\`\`tsx no-check\n${example}\`\`\`\n`, env);
  const rest = demo.chunks.length - 2;
  return `<section aria-labelledby="sample-title">
  <h2 class="row-title" id="sample-title">The code <code>examples/todo/src/todo.idlip.tsx</code></h2>
  <div class="sample">
    <div class="tile tile-code">${code}</div>
    <ul class="tile chunks">
      <li><code>${escape(demo.loader.name)}</code><span>${formatBytes(demo.loader.gzip)}, loads with the page</span></li>
      <li><code>${escape(demo.handler.name)}</code><span>${formatBytes(demo.handler.gzip)}, the first click on a checkbox</span></li>
      <li><code>${escape(demo.binding.name)}</code><span>${formatBytes(demo.binding.gzip)}, the same click</span></li>
      <li><code>${rest} more chunks</code><span>The event that needs each one</span></li>
    </ul>
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
  const { base, start, pages, example, demo, benchmarks } = context;
  return `<!doctype html>
<html lang="en">
${renderHead(base, 'idlip', 'A UI framework that resumes in the browser where the server stopped.')}
<body>
<a class="skip" href="#content">Skip to the content</a>
${renderHeader(base, start)}
<main id="content" class="landing">
  ${renderHero(base, start)}
  ${renderResume(demo)}
  ${renderFeatures(pages, base)}
  ${renderBenchmarks(benchmarks, findBenchmarksLink(pages, base, benchmarks.source))}
  ${renderSample(example, demo)}
</main>
${renderFooter()}
</body>
</html>
`;
}
