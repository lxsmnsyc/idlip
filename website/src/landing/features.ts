import { ICON, escape } from '../layout.ts';
import type { Page } from '../site.ts';

export interface Feature {
  title: string;
  /** HTML. */
  text: string;
  code: string;
  /** The Markdown file of the guide page, inside `docs`. */
  page: string;
}

export const FEATURES: Feature[] = [
  {
    title: 'MVU',
    text: 'The model is plain data. Handlers write it and the view reads it.',
    code: 'todos = [...todos, todo]',
    page: 'components.md',
  },
  {
    title: 'Resumability',
    text: 'The server sends HTML and the model. No view code runs on load.',
    code: '<script i-state>',
    page: 'resuming.md',
  },
  {
    title: 'TSX function components',
    text: '<code>let</code> is state, <code>const</code> is derived, a function is a handler, <code>return</code> is the view.',
    code: 'export default function TodoApp()',
    page: 'views.md',
  },
  {
    title: 'Subscriptions',
    text: 'A timer or a socket is a node in the view. It runs while its block is on the page.',
    code: '<Subscribe to={timer} />',
    page: 'subscriptions.md',
  },
  {
    title: 'Effects',
    text: 'An <code>await</code> in a handler. The compiler splits the handler at the <code>await</code>.',
    code: 'user = await loadUser(id)',
    page: 'effects.md',
  },
  {
    title: 'Nesting',
    text: 'A child keeps its own model. A click inside it loads only its chunks.',
    code: '<Counter start={0} />',
    page: 'nesting.md',
  },
  {
    title: 'Vite plugin',
    text: 'One chunk per handler, binding group and list. Server pages in <code>vite dev</code>.',
    code: 'plugins: [idlip()]',
    page: 'reference/vite.md',
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

/** The feature grid. Each card links to its guide page. */
export function renderFeatures(pages: readonly Page[], base: string): string {
  let cards = '';
  for (const feature of FEATURES) {
    const page = findPage(pages, feature.page);
    cards += `<li class="feature"><a href="${base}${page.url}"><h3>${escape(feature.title)}${ICON.arrow}</h3><p>${feature.text}</p><code class="feature-code">${escape(feature.code)}</code></a></li>`;
  }
  return `<section aria-labelledby="features-title">
  <h2 class="row-title" id="features-title">Features</h2>
  <ul class="features">${cards}</ul>
</section>`;
}
