// oxlint-disable import/prefer-default-export
// The MVU loop: Model, Update and View on a ring. The server turns the loop once, Model to View,
// and writes the model into `<script i-state>`. In the browser the loop waits. The click wakes
// Update, then Model, then the one binding of the path that changed, and the row and the count
// change. Names, sizes, todos and paths come from the demo build.
import type { DemoData } from '../demo/data.ts';
import { escape } from '../layout.ts';
import {
  FIGURE_ICON,
  readClick,
  renderCall,
  renderChip,
  renderFrame,
  renderMeter,
  renderSwap,
  renderTodoApp,
  sayLoaded,
  sayUndone,
} from './parts.ts';
import type { Story } from './parts.ts';

const STEPS = [
  { id: 'start', ms: 400 },
  // The server: the model renders the page, then goes into the state script.
  { id: 'render', ms: 1000 },
  { id: 'seal', ms: 900 },
  // The browser: the page shows, the loop waits for an event.
  { id: 'ship', ms: 1100 },
  { id: 'aim', ms: 700 },
  { id: 'press', ms: 200 },
  // The click: Update, Model and View light one after the other.
  { id: 'update', ms: 900 },
  { id: 'model', ms: 900 },
  { id: 'view', ms: 800 },
  { id: 'patch', ms: 0 },
];

export function renderMvuLoop(demo: DemoData): string {
  const click = readClick(demo);
  const story: Story = {
    steps: STEPS,
    press: 'press',
    patch: 'patch',
    back: 'ship',
    live: { done: sayLoaded(click), undone: sayUndone(click) },
  };

  // The model: one line per todo, and the clicked one changes at Model.
  let fields = '';
  for (const [index, todo] of demo.todos.entries()) {
    const path = escape(demo.writes[0].replace('.*', `[${index}]`));
    const value =
      index === click.index
        ? renderSwap(String(todo.done), String(!todo.done), 'model', ' fig-val')
        : `<span class="fig-plain">${String(todo.done)}</span>`;
    fields += `<span class="fig-field"><span class="fig-key">${path}</span>${value}</span>`;
  }
  const [handler, ...more] = click.update;
  let extra = '';
  for (const file of more) {
    extra += renderChip(file);
  }

  const head = `<div class="fig-head" aria-hidden="true">
    <span class="fig-phase"><i class="fig-thumb"></i><span class="fig-seg s-server">${FIGURE_ICON.server}Server</span><span class="fig-seg s-browser">${FIGURE_ICON.view}Browser</span></span>
    ${renderMeter(click)}
  </div>`;

  const body = `<svg class="fig-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="44" rx="30" ry="39"/><path class="fig-arc arc-top" d="M20 44A30 39 0 0 1 80 44"/><path class="fig-arc arc-right" d="M80 44A30 39 0 0 1 50 83"/><path class="fig-arc arc-left" d="M50 83A30 39 0 0 1 20 44"/></svg>
    <div class="fig-node fig-model" aria-hidden="true"><span class="fig-node-head">${FIGURE_ICON.model}Model</span><span class="fig-fields">${fields}</span></div>
    <div class="fig-node fig-update" aria-hidden="true"><span class="fig-node-head">${FIGURE_ICON.update}Update${renderChip(handler)}</span><code class="fig-node-body">${renderSwap('waits for an event', renderCall(demo), 'update', ' fig-call')}</code><span class="fig-more">${extra}</span></div>
    <div class="fig-view">${renderTodoApp(demo, click, 'patch', `<span class="fig-node-head">${FIGURE_ICON.view}View</span>`)}<span class="fig-capsule" aria-hidden="true"><code>${escape(click.stateTag)}</code></span></div>
    <span class="fig-bind" aria-hidden="true">${renderChip(click.binding)}</span>`;

  return renderFrame({
    name: 'mvu-loop',
    story,
    kind: 'fig-mvu',
    head,
    body,
    caption:
      'The server runs the loop once, and a click in the browser runs Update, Model and one binding of the View.',
  });
}
