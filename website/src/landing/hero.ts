// oxlint-disable import/prefer-default-export
// The hero picture: a page the server renders once, then a click on one todo wakes the todo
// block, which runs Update, Model and View once and loads only the code of that click. A
// timeline under it shows the component code loaded and can be scrubbed. Every name, size, todo,
// message and path comes from the demo build (`DemoData`). The server writes the still frame
// (`STILL_AT`), which is what shows without JS and with reduced motion. `src/client/hero.ts`
// plays the story and lets the visitor click and scrub.
import type { DemoData } from '../demo/data.ts';
import { ICON, escape } from '../layout.ts';
import { formatBytes } from './format.ts';

/**
 * The story on a 0 to 1 timeline. The client reads these from `data-story`, so the server markup
 * and the script agree on when each moment starts.
 */
export const STORY_AT = {
  render: 0.02,
  modeled: 0.17,
  rendered: 0.2,
  seal: 0.23,
  load: 0.3,
  aim: 0.36,
  click: 0.44,
  unfold: 0.455,
  update: 0.49,
  model: 0.56,
  view: 0.63,
  patch: 0.67,
  fold: 0.8,
};

/** The moments that set an `on-<name>` class on the stage, so CSS transitions reverse. */
export const STORY_CLASSES = [
  'modeled',
  'seal',
  'load',
  'click',
  'unfold',
  'update',
  'model',
  'view',
  'patch',
  'fold',
] as const;

/** The still frame: the loop has run and is still open beside the todo block. */
export const STILL_AT = 0.74;

/** The todo the click flips: the first one not done, else the first one. */
function findClicked(todos: DemoData['todos']): number {
  for (const [index, todo] of todos.entries()) {
    if (!todo.done) {
      return index;
    }
  }
  return 0;
}

function countLeft(todos: DemoData['todos'], flip: number): number {
  let left = 0;
  for (const [index, todo] of todos.entries()) {
    const done = index === flip ? !todo.done : todo.done;
    if (!done) {
      left++;
    }
  }
  return left;
}

/** The arguments of the message on the checkbox, such as `["a2"]` in `["toggle",["a2"]]`. */
function readArgs(token: string): string[] {
  try {
    const message: unknown = JSON.parse(token);
    if (Array.isArray(message) && Array.isArray(message[1])) {
      const args: string[] = [];
      for (const arg of message[1]) {
        args.push(String(arg));
      }
      return args;
    }
  } catch {
    // A token that is not JSON shows no arguments.
  }
  return [];
}

/** The chunk name without its module and kind: `toggle.js` for `todo.handler.toggle.js`. */
export function shortenChunk(name: string): string {
  return name.replace(/^[^.]+\.(?:handler|binding|list)\./, '');
}

/** The path the click changes: `todos[1].done` for `todos.*.done` and the second todo. */
function nameChangedPath(writes: string[], index: number): string {
  const path = writes[0] ?? '';
  return path.replace('.*', `[${index}]`);
}

/** The opening tag of the state script, such as `<script i-state>`. */
function readStateTag(state: string): string {
  return /^<script[^>]*>/.exec(state)?.[0] ?? '<script>';
}

/** Highlights a message such as `["toggle",["a2"]]`: strings in the string color. */
function highlightMessage(token: string): string {
  let html = '';
  let last = 0;
  for (const match of token.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
    html += escape(token.slice(last, match.index));
    html += `<span class="hero-str">${escape(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return `<span>${html}${escape(token.slice(last))}</span>`;
}

const ICON_LOOP =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></svg>';
const ICON_MODEL =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>';
const ICON_VIEW =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>';
const ICON_TO =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** The blocks of the page the server rendered around the todo app. Placed by CSS. */
const BLOCKS = [
  'logo',
  'nav-1 soft',
  'nav-2 soft',
  'nav-3 soft',
  'btn',
  'line-1 under',
  'line-2 under',
  'text-1 soft under',
  'text-2 soft under',
  'text-3 soft under',
  'media under',
];

function renderRow(todo: DemoData['todos'][number], index: number, flip: number): string {
  const clicked = index === flip;
  const done = clicked ? !todo.done : todo.done;
  // The pointer of the autoplay sits on the row it clicks.
  const target = clicked ? ' data-target' : '';
  const pointer = clicked
    ? `<span class="hero-pointer" aria-hidden="true">${ICON.pointer}</span>`
    : '';
  return `<label class="hero-row" data-row data-rest="${todo.done ? 1 : 0}" style="--done:${done ? 1 : 0}"${target}><input class="visually-hidden" type="checkbox"${done ? ' checked' : ''} disabled><span class="hero-box">${ICON.check}</span><span class="hero-text">${escape(todo.text)}</span><i class="hero-flash"></i>${pointer}</label>`;
}

/** A chunk chip of a step: the short name, the size, and the full name as a tooltip. */
function renderChip(name: string, gzip: number): string {
  return `<span class="hero-chip" title="${escape(name)}">${escape(shortenChunk(name))} <b>${formatBytes(gzip)}</b></span>`;
}

/** The texts of the timeline slider, by the time each one starts. */
function writeSteps(demo: DemoData, path: string, before: boolean): [number, string][] {
  const loaded = formatBytes(demo.handler.gzip + demo.binding.gzip);
  return [
    [0, 'The server renders the page'],
    [STORY_AT.seal, 'The server writes the state into the page'],
    [
      STORY_AT.load,
      `Page loaded with ${demo.loader.name}, ${formatBytes(demo.loader.gzip)}. No component code ran`,
    ],
    [STORY_AT.click, `Click. Update loads ${demo.handler.name}, ${formatBytes(demo.handler.gzip)}`],
    [STORY_AT.model, `Model: ${path} turns ${String(!before)}`],
    [STORY_AT.view, `View loads ${demo.binding.name}, ${formatBytes(demo.binding.gzip)}`],
    [STORY_AT.patch, `One row and the count changed. ${loaded} of component code loaded`],
  ];
}

/** The text of the slider at `at`: the last step that started by then. */
function findStep(steps: [number, string][], at: number): string {
  let text = '';
  for (const [start, step] of steps) {
    if (start <= at) {
      text = step;
    }
  }
  return text;
}

/** The picture: the browser frame with the page and the todo app, and the timeline. */
export function renderHeroStage(demo: DemoData): string {
  const flip = findClicked(demo.todos);
  const before = demo.todos[flip]?.done ?? false;
  const args = readArgs(demo.token);
  const path = nameChangedPath(demo.writes, flip);
  const handler = formatBytes(demo.handler.gzip);
  const loaded = formatBytes(demo.handler.gzip + demo.binding.gzip);
  const steps = writeSteps(demo, path, before);

  // The classes and the timeline of the still frame.
  let classes = 'hero-stage';
  for (const name of STORY_CLASSES) {
    if (STORY_AT[name] <= STILL_AT) {
      classes += ` on-${name}`;
    }
  }
  const story = {
    at: STORY_AT,
    classes: STORY_CLASSES,
    still: STILL_AT,
    steps,
    live: {
      first: `Loaded ${demo.handler.name}, ${handler}, and ${demo.binding.name}, ${formatBytes(demo.binding.gzip)}. One row and the count changed.`,
      later: 'Already loaded.',
    },
  };

  // The page around the todo app, and its rows.
  let blocks = '';
  for (const block of BLOCKS) {
    blocks += `<i class="hero-blk b-${block}"></i>`;
  }
  let rows = '';
  for (const [index, todo] of demo.todos.entries()) {
    rows += renderRow(todo, index, flip);
  }

  // The ticks of the timeline and their labels. A narrow stage hides the first word.
  let ticks = '';
  for (const [name, first, word] of [
    ['render', 'server ', 'render'],
    ['load', 'page ', 'load'],
    ['click', '', 'click'],
  ] as const) {
    const lead = first ? `<span class="hero-tick-lead">${first}</span>` : '';
    ticks += `<i class="hero-tick" style="--at:${STORY_AT[name]}"></i><span class="hero-tick-label l-${name}" style="--at:${STORY_AT[name]}">${lead}${word}</span>`;
  }

  return `<figure class="${classes}" data-hero data-step="click" style="--t:${STILL_AT}" data-story="${escape(JSON.stringify(story))}" aria-label="A page the server rendered once. One click wakes the todo block, which loads only the code of that click.">
  <p class="visually-hidden" role="status" aria-live="polite" data-hero-live></p>
  <div class="hero-frame">
    <div class="hero-bar"><span class="hero-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="hero-net" title="${escape(demo.loader.name)}, with the page">${escape(demo.loader.name)} <b>${formatBytes(demo.loader.gzip)}</b></span></div>
    <div class="hero-page">
      <div class="hero-blocks" aria-hidden="true">${blocks}</div>
      <div class="hero-app">
        <div class="hero-app-head"><span class="hero-app-title">Todos</span><span class="hero-count"><b data-left>${countLeft(demo.todos, flip)}</b> left<i class="hero-flash"></i></span></div>
        ${rows}
        <i class="hero-wake"></i>
      </div>
      <div class="hero-seal" aria-hidden="true"><span class="hero-seal-open">${ICON_MODEL}model</span><span class="hero-seal-shut">${ICON.lock}<code>${escape(readStateTag(demo.state))}</code></span></div>
      <div class="hero-strip" aria-hidden="true">
        <div class="hero-step s-update"><div class="hero-step-head"><span class="hero-step-name">${ICON_LOOP}Update</span>${renderChip(demo.handler.name, demo.handler.gzip)}</div><code class="hero-step-body">${highlightMessage(demo.token)}</code></div>
        <div class="hero-step s-model"><div class="hero-step-head"><span class="hero-step-name">${ICON_MODEL}Model</span></div><code class="hero-step-body"><span class="hero-path">${escape(path)}</span><span>${String(before)}</span>${ICON_TO}<span class="hero-val"><span class="v-was">${String(before)}</span><span class="v-now">${String(!before)}</span></span></code></div>
        <div class="hero-step s-view"><div class="hero-step-head"><span class="hero-step-name">${ICON_VIEW}View</span>${renderChip(demo.binding.name, demo.binding.gzip)}</div><code class="hero-step-body"><span class="hero-path">row ${escape(args[0] ?? '')}, count</span></code></div>
      </div>
      <i class="hero-scan"></i>
    </div>
  </div>
  <div class="hero-timeline">
    <div class="hero-tl-head" aria-hidden="true"><p class="hero-tl-title">Component code loaded</p><p class="hero-tl-value"><i class="hero-cached">cached</i><span class="hero-vals"><span class="v0">0 B</span><span class="v1">${handler}</span><span class="v2">${loaded}</span></span></p></div>
    <div class="hero-track" data-scrub>
      <i class="hero-base" style="--at:${STORY_AT.update}"></i><i class="hero-area" style="--at:${STORY_AT.update}"></i>${ticks}
      <i class="hero-mask"></i>
      <div class="hero-run"><i class="hero-head"></i><button class="hero-knob" type="button" role="slider" aria-label="Timeline" title="Drag, or use the arrow keys" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(STILL_AT * 100)}" aria-valuetext="${escape(findStep(steps, STILL_AT))}" disabled></button></div>
    </div>
  </div>
  <figcaption class="hero-caption">A model of the todo demo build. Nothing is fetched.</figcaption>
</figure>`;
}
