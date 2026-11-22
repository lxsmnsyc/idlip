import { escape } from '../layout.ts';
import type { Page } from '../site.ts';

export interface Feature {
  /** What the visitor gains. */
  title: string;
  /** The feature behind it, one short line. HTML. */
  text: string;
  /** The Markdown file of the guide page, inside `docs`. */
  page: string;
}

export const FEATURES: Feature[] = [
  {
    title: 'Nothing runs before the page works',
    text: 'The browser resumes from HTML and the model.',
    page: 'resuming.md',
  },
  {
    title: 'Grow the app, not the first load',
    text: 'A click loads only the chunks it needs.',
    page: 'nesting.md',
  },
  {
    title: 'Components are plain functions',
    text: '<code>let</code> is state, <code>return</code> is the view.',
    page: 'views.md',
  },
  {
    title: 'Async with no callbacks',
    text: 'An <code>await</code> in a handler. The compiler splits it.',
    page: 'effects.md',
  },
];

function findPage(pages: readonly Page[], file: string): Page {
  for (const page of pages) {
    if (page.file === file) {
      return page;
    }
  }
  throw new Error(`The feature grid links to docs/${file}, which does not exist`);
}

/** The benefit cards. Each card links to its guide page. */
export function renderFeatures(pages: readonly Page[], base: string): string {
  let cards = '';
  for (const feature of FEATURES) {
    const page = findPage(pages, feature.page);
    cards += `<li class="feature"><a href="${base}${page.url}"><h3>${escape(feature.title)}</h3><p>${feature.text}</p></a></li>`;
  }
  return `<section aria-labelledby="features-title">
  <h2 class="row-title" id="features-title">What you get</h2>
  <ul class="features">${cards}</ul>
</section>`;
}
