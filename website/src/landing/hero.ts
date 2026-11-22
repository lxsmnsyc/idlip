// oxlint-disable import/prefer-default-export
// The hero picture: the todo demo at rest with no component code loaded, then one click on a
// checkbox loads the two chunks it needs and updates one row and the count. Every name, size and
// todo comes from the demo build (`DemoData`). The server writes the end state, which is the still
// frame without JS and with reduced motion. `src/client/hero.ts` plays it and lets the visitor click.
import type { DemoData } from '../demo/data.ts';
import { ICON, escape } from '../layout.ts';
import { formatBytes } from './format.ts';

/** The todo the click flips: the first one not done, else the first one. */
function findClicked(todos: DemoData['todos']): number {
  for (const [index, todo] of todos.entries()) {
    if (!todo.done) {
      return index;
    }
  }
  return 0;
}

function countLeft(todos: DemoData['todos'], flip: number, after: boolean): number {
  let left = 0;
  for (const [index, todo] of todos.entries()) {
    const done = after && index === flip ? !todo.done : todo.done;
    if (!done) {
      left++;
    }
  }
  return left;
}

function renderRow(todo: DemoData['todos'][number], index: number, flip: number): string {
  const clicked = index === flip;
  const done = clicked ? !todo.done : todo.done;
  const rest = todo.done ? 1 : 0;
  const attrs = clicked
    ? ` data-flip style="--done:${done ? 1 : 0};--rest:${rest}"`
    : ` style="--done:${done ? 1 : 0}"`;
  const pointer = clicked
    ? `<span class="hero-pointer" aria-hidden="true">${ICON.pointer}</span>`
    : '';
  return `<label class="hero-row"${attrs}><input class="visually-hidden" type="checkbox"${done ? ' checked' : ''} disabled><span class="hero-box">${ICON.check}</span><span class="hero-text">${escape(todo.text)}</span>${pointer}</label>`;
}

/** A chip of a file. The loader loads with the page. A click loads the others. */
function renderChip(name: string, gzip: number, load: boolean): string {
  // The "cached" mark is for the eye. The live line says it for screen readers.
  const hit = load ? '<i class="hero-hit" aria-hidden="true">cached</i>' : '';
  const note = load ? '' : ', with the page';
  return `<li class="hero-chip${load ? ' hero-chip-load' : ''}"><code>${escape(name)}</code><span>${formatBytes(gzip)}${note}</span>${hit}</li>`;
}

/** The picture: a meter of component code loaded, the app, and the chunks that arrived. */
export function renderHeroStage(demo: DemoData): string {
  const flip = findClicked(demo.todos);
  let rows = '';
  for (const [index, todo] of demo.todos.entries()) {
    rows += renderRow(todo, index, flip);
  }
  const loaded = demo.handler.gzip + demo.binding.gzip;
  const before = countLeft(demo.todos, flip, false);
  const after = countLeft(demo.todos, flip, true);
  const first = `Loaded ${demo.handler.name} and ${demo.binding.name}, ${formatBytes(loaded)}.`;
  return `<figure class="hero-stage" data-hero aria-label="The todo demo, with the code each click loads">
  <p class="visually-hidden" role="status" aria-live="polite" data-hero-live data-first="${escape(first)}" data-later="Already loaded."></p>
  <div class="hero-meter">
    <p class="hero-meter-title">Component code loaded</p>
    <p class="hero-meter-value hero-stack"><span class="hero-rest" aria-hidden="true">0 B</span><span class="hero-now">${formatBytes(loaded)}</span></p>
  </div>
  <div class="hero-app">
    <p class="hero-left hero-stack"><span class="hero-rest" aria-hidden="true"><b>${before}</b> left</span><span class="hero-now"><b data-left>${after}</b> left</span></p>
    ${rows}
  </div>
  <ul class="hero-chunks">
    ${renderChip(demo.loader.name, demo.loader.gzip, false)}
    ${renderChip(demo.handler.name, demo.handler.gzip, true)}
    ${renderChip(demo.binding.name, demo.binding.gzip, true)}
  </ul>
  <figcaption class="hero-caption">A model of the todo demo build. Nothing is fetched.</figcaption>
</figure>`;
}
