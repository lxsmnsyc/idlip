// The parts both docs figures share: what the click does in the demo build, the todo app with its
// clickable row, the chunk chips, the meter and the frame around a figure. The server writes the
// end state of the story. `src/figures/player.ts` plays it in the browser.
import type { DemoData, DemoFile } from '../demo/data.ts';
import { formatBytes, sumGzip } from '../landing/format.ts';
import { findClicked, shortenChunk } from '../landing/hero.ts';
import { ICON, escape } from '../layout.ts';

/** One step of a story: the class `on-<id>` turns on, and the next step comes after `ms`. */
export interface Step {
  id: string;
  ms: number;
}

/** What the player reads from `data-story`. */
export interface Story {
  steps: Step[];
  /** The step where the click lands. A click on the row before it plays the story from here. */
  press: string;
  /** The step where the row changes. The live line speaks here. */
  patch: string;
  /** The step a click after the patch goes back to: the row as the server rendered it. */
  back: string;
  live: {
    /** Said when the row changes. */
    done: string;
    /** Said when a click undoes the change. */
    undone: string;
  };
}

/** What one click on the todo the checkbox message names does, read from the demo build. */
export interface Click {
  /** The place of the clicked todo in `demo.todos`. */
  index: number;
  /** The id in the message, such as `a2`. */
  id: string;
  /** The text of the clicked todo. */
  text: string;
  /** `done` of the clicked todo before the click. */
  before: boolean;
  /** The path that changes, such as `todos[1].done`. */
  path: string;
  /** The path the handler writes, such as `todos.*.done`. */
  writes: string;
  /** The files the handler step loads: the handler chunk, and the helpers when the build has them. */
  update: DemoFile[];
  binding: DemoFile;
  /** The gzip sizes after the handler step and after the binding, formatted. */
  updateBytes: string;
  totalBytes: string;
  /** The opening tag of the state script, such as `<script i-state>`. */
  stateTag: string;
  /** The count of todos left before and after the click. */
  left: { before: number; after: number };
}

/** The arguments of a message such as `["toggle",["a2"]]`, as JSON texts. */
function readArgs(token: string): string[] {
  const message: unknown = JSON.parse(token);
  const args: string[] = [];
  if (Array.isArray(message) && Array.isArray(message[1])) {
    for (const arg of message[1]) {
      args.push(JSON.stringify(arg));
    }
  }
  return args;
}

function countLeft(todos: DemoData['todos'], flip: number): number {
  let left = 0;
  for (const [index, todo] of todos.entries()) {
    if (!(index === flip ? !todo.done : todo.done)) {
      left++;
    }
  }
  return left;
}

/** Reads the click from the demo build. Throws, and so fails the build, if a part is missing. */
export function readClick(demo: DemoData): Click {
  const index = findClicked(demo);
  const todo = demo.todos[index];
  const writes = demo.writes.at(0);
  if (writes === undefined) {
    throw new Error(`The demo handler ${demo.handlerName} writes no model path`);
  }
  const update = demo.helpers ? [demo.handler, demo.helpers] : [demo.handler];
  return {
    index,
    id: todo.id,
    text: todo.text,
    before: todo.done,
    path: writes.replace('.*', `[${index}]`),
    writes,
    update,
    binding: demo.binding,
    updateBytes: formatBytes(sumGzip(update)),
    totalBytes: formatBytes(sumGzip([...update, demo.binding])),
    stateTag: /^<script[^>]*>/.exec(demo.state)?.[0] ?? '<script>',
    left: { before: countLeft(demo.todos, -1), after: countLeft(demo.todos, index) },
  };
}

/** Joins words as a list: `a`, `a and b`, `a, b and c`. */
function joinList(items: string[]): string {
  if (items.length < 2) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/** The live line when the row changes: the files the click loaded and their total. */
export function sayLoaded(click: Click): string {
  const said: string[] = [];
  for (const file of [...click.update, click.binding]) {
    said.push(`${file.name}, ${formatBytes(file.gzip)}`);
  }
  return `Loaded ${joinList(said)}: ${click.totalBytes}. One row and the count changed.`;
}

/** The live line when a click undoes the change. */
export function sayUndone(click: Click): string {
  return `${click.text} is ${click.before ? 'done' : 'not done'} again.`;
}

/** Highlights strings in code such as `["toggle",["a2"]]` with the string color. */
export function highlightStrings(code: string): string {
  let html = '';
  let last = 0;
  for (const match of code.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
    html += escape(code.slice(last, match.index));
    html += `<span class="fig-str">${escape(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return html + escape(code.slice(last));
}

/** The message as a call, such as `toggle("a2")`, highlighted. */
export function renderCall(demo: DemoData): string {
  return `<span class="fig-fn">${escape(demo.handlerName)}</span>(${highlightStrings(readArgs(demo.token).join(', '))})`;
}

function drawIcon(size: number, body: string): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** The icons of the figures, in the site's set: 24px grid, 1.8px stroke. */
export const FIGURE_ICON = {
  update: drawIcon(
    14,
    '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  ),
  model: drawIcon(
    14,
    '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  ),
  view: drawIcon(14, '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/>'),
  server: drawIcon(
    14,
    '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  ),
  binding: drawIcon(
    14,
    '<path d="M9 15l6-6M10.5 6.5l1.8-1.8a4 4 0 0 1 5.7 5.7l-1.8 1.8M13.5 17.5l-1.8 1.8a4 4 0 0 1-5.7-5.7l1.8-1.8"/>',
  ),
  to: drawIcon(12, '<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

/** A chunk chip: the short name and the size, with the full name as a tooltip. */
export function renderChip(file: DemoFile, extra = ''): string {
  return `<span class="fig-chip${extra}" title="${escape(file.name)}">${escape(shortenChunk(file.name))} <b>${formatBytes(file.gzip)}</b></span>`;
}

/** A value that changes at the class `on-<step>`: the old one leaves upwards, the new one comes in. */
export function renderSwap(was: string, now: string, step: string, extra = ''): string {
  return `<span class="fig-swap at-${step}${extra}"><span class="fig-was">${was}</span><span class="fig-now">${now}</span></span>`;
}

/**
 * The todo app, under `title` (HTML). The clicked row is a real checkbox: the server writes it disabled, and the player
 * enables it. The other rows only show.
 */
export function renderTodoApp(
  demo: DemoData,
  click: Click,
  patch: string,
  title = '<span class="hero-app-title">Todos</span>',
): string {
  let rows = '';
  for (const [index, todo] of demo.todos.entries()) {
    if (index === click.index) {
      const now = !todo.done;
      rows += `<label class="hero-row fig-row" data-target style="--was:${todo.done ? 1 : 0};--now:${now ? 1 : 0}"><input class="visually-hidden" type="checkbox"${now ? ' checked' : ''} disabled data-figure-toggle><span class="hero-box">${ICON.check}</span><span class="hero-text">${escape(todo.text)}</span><i class="fig-flash"></i><span class="fig-pointer" aria-hidden="true">${ICON.pointer}</span></label>`;
    } else {
      rows += `<span class="hero-row fig-row is-still" style="--done:${todo.done ? 1 : 0}" aria-hidden="true"><span class="hero-box">${ICON.check}</span><span class="hero-text">${escape(todo.text)}</span></span>`;
    }
  }
  return `<div class="fig-app">
    <div class="hero-app-head" aria-hidden="true">${title}<span class="hero-count fig-count">${renderSwap(`<b>${click.left.before}</b>`, `<b>${click.left.after}</b>`, patch)} left<i class="fig-flash"></i></span></div>
    ${rows}
  </div>`;
}

/** The code the click loaded: 0 B, then the handler step, then with the binding. */
export function renderMeter(click: Click): string {
  return `<div class="fig-meter" aria-hidden="true"><span class="fig-meter-label">Code loaded on click</span><span class="fig-meter-value"><span class="fig-v0">0 B</span><span class="fig-v1">${click.updateBytes}</span><span class="fig-v2">${click.totalBytes}</span></span></div>`;
}

export interface FigureFrame {
  name: string;
  story: Story;
  /** A class for the layout of this figure. */
  kind: string;
  /** Above the well: a header row, or nothing. */
  head: string;
  /** The drawing. */
  body: string;
  /** One sentence, as HTML. */
  caption: string;
}

/**
 * The figure around a drawing. The server writes the last step, with every `on-<id>` class, so
 * the page shows the end of the story without the script and with reduced motion.
 */
export function renderFrame(frame: FigureFrame): string {
  let classes = `fig ${frame.kind}`;
  for (const step of frame.story.steps) {
    classes += ` on-${step.id}`;
  }
  const last = frame.story.steps.at(-1)?.id ?? '';
  return `<figure class="${classes}" data-figure="${escape(frame.name)}" data-step="${escape(last)}" data-story="${escape(JSON.stringify(frame.story))}">
  <p class="visually-hidden" role="status" aria-live="polite" data-figure-live></p>
  ${frame.head}
  <div class="fig-well">${frame.body}</div>
  <div class="fig-foot"><figcaption>${frame.caption}</figcaption><button class="icon-button fig-replay" type="button" aria-label="Replay" title="Replay" hidden data-figure-replay>${ICON.reload}</button></div>
</figure>`;
}
