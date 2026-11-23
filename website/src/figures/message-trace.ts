// oxlint-disable import/prefer-default-export
// Message trace: the click on a todo, from the message in its markup to the row it changes. The
// handler chunk runs the message, the model names the path that changed, and the binding chunk of
// that path changes the row and the count. Each card names its chunk. The markup, names, sizes and
// paths come from the demo build.
import type { DemoData } from '../demo/data.ts';
import { formatBytes } from '../landing/format.ts';
import { ICON, escape } from '../layout.ts';
import {
  FIGURE_ICON,
  highlightStrings,
  readClick,
  renderCall,
  renderFrame,
  renderMeter,
  renderSwap,
  renderTodoApp,
  sayStory,
} from './parts.ts';
import type { Story } from './parts.ts';

const STEPS = [
  { id: 'start', ms: 500 },
  { id: 'aim', ms: 700 },
  { id: 'press', ms: 200 },
  // The handler chunk loads, its event function builds the message, and the handler runs it.
  { id: 'send', ms: 1000 },
  // The model changes one path.
  { id: 'model', ms: 1000 },
  // The binding chunk of that path loads and changes the row and the count.
  { id: 'binding', ms: 900 },
  { id: 'patch', ms: 0 },
];

/**
 * The checkbox of the clicked todo as the server wrote it, one attribute per line, with the
 * event function marked. Throws when the markup has no checkbox that runs it.
 */
function renderMarkup(demo: DemoData): string {
  const tag = /<input\b([^>]*)>/.exec(demo.row);
  if (!tag?.[1].includes(demo.site)) {
    throw new Error(`The demo row has no checkbox that runs ${demo.site}: ${demo.row}`);
  }
  let lines = '<span class="fig-tag">&lt;input</span>';
  for (const match of tag[1].matchAll(/([\w:-]+)(?:=('[^']*'|"[^"]*"))?/g)) {
    const name = match[1];
    const value = match.at(2);
    let html = `<span class="fig-attr">${escape(name)}</span>`;
    if (value?.includes(demo.site)) {
      html += `=\n    <span class="fig-msg">${highlightStrings(value)}</span>`;
    } else if (value !== undefined) {
      html += `=<span class="fig-str">${escape(value)}</span>`;
    }
    lines += `\n  ${html}`;
  }
  return `<pre class="fig-code" aria-hidden="true"><code>${lines}<span class="fig-tag">&gt;</span></code></pre>`;
}

/** A size that is locked until its step: the lock and the size, then the size lit. */
function renderSize(bytes: number, step: string): string {
  return renderSwap(`${ICON.lock}${formatBytes(bytes)}`, formatBytes(bytes), step, ' fig-size');
}

export function renderMessageTrace(demo: DemoData): string {
  const click = readClick(demo);
  const story: Story = {
    steps: STEPS,
    press: 'press',
    patch: 'patch',
    live: sayStory(click),
  };
  const [handler, ...more] = click.update;
  let extra = '';
  for (const file of more) {
    extra += `<span class="fig-file-row"><span class="fig-file">${escape(file.name)}</span>${renderSize(file.gzip, 'send')}</span>`;
  }

  const body = `<div class="fig-col">
      ${renderTodoApp(demo, click, 'patch')}
      ${renderMarkup(demo)}
      ${renderMeter(click)}
    </div>
    <div class="fig-col" aria-hidden="true">
      <div class="fig-card c-update"><span class="fig-node-head">${FIGURE_ICON.update}Update${renderSize(handler.gzip, 'send')}</span><span class="fig-file">${escape(handler.name)}</span>${extra}<code class="fig-node-body">${renderSwap('waits for a message', renderCall(demo), 'send', ' fig-call')}</code></div>
      <div class="fig-card c-model"><span class="fig-node-head">${FIGURE_ICON.model}Model<span class="fig-path">${escape(click.writes)}</span></span><span class="fig-file">${escape(click.stateTag)} in the page</span><code class="fig-node-body"><span class="fig-key">${escape(click.path)}</span>${renderSwap(String(click.before), String(!click.before), 'model', ' fig-val')}</code></div>
      <div class="fig-card c-binding"><span class="fig-node-head">${FIGURE_ICON.binding}Binding${renderSize(click.binding.gzip, 'binding')}</span><span class="fig-file">${escape(click.binding.name)}</span><span class="fig-targets"><span class="fig-target">row ${escape(click.id)}</span><span class="fig-target">count</span></span></div>
    </div>`;

  return renderFrame({
    name: 'message-trace',
    story,
    kind: 'fig-trace',
    head: '',
    body,
    caption: `The checkbox names an event function whose message runs the handler, which writes <code>${escape(click.writes)}</code>, and the binding of that path changes the row and the count.`,
  });
}
