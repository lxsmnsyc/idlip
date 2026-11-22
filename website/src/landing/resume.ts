// oxlint-disable import/prefer-default-export
// The resume diagram: the same todo app in two lanes, hydration and resumption, over four steps.
// Every name and size comes from the demo build (`DemoData`), so the figure follows the code.
import type { DemoData, DemoFile } from '../demo/data.ts';
import { ICON, escape } from '../layout.ts';
import { createRenderer } from '../markdown.ts';
import type { RenderEnv } from '../markdown.ts';
import { formatBytes, sumGzip } from './format.ts';

const STEPS = ['Render', 'Load', 'Click', 'Patch'];

type Lane = 'hydrate' | 'resume';

/** The values of a counter at steps 1 to 4. */
type Series = [number, number, number, number];

interface Counts {
  js: Series;
  runs: Series;
}

/** What each lane loads and runs at each step. */
function countSteps(data: DemoData): Record<Lane, Counts> {
  // Hydration loads every component chunk on load and runs TodoApp once and each row once.
  const all = sumGzip(data.chunks);
  const renders = 1 + data.todos.length;
  // Resumption fetches the handler and the binding chunk of its write set on the click. The
  // handler runs on the click and the binding chunk on the patch.
  const click = data.handler.gzip + data.binding.gzip;
  return {
    hydrate: { js: [0, all, all, all], runs: [0, renders, renders + 1, renders + 2] },
    resume: { js: [0, 0, click, click], runs: [0, 0, 1, 2] },
  };
}

function code(text: string): string {
  return `<code>${escape(text)}</code>`;
}

/**
 * The sentence over both lanes, for a reader who has never heard of resumability. The stepper
 * hides the visible sentences from screen readers and announces the current one in a single
 * live element, which the client rewrites on each step.
 */
function renderSays(data: DemoData, live: boolean): string {
  const lines = [
    'The server sends HTML. The page shows before any script runs.',
    `Hydration downloads and reruns every component. Resumption waits behind a ${formatBytes(data.listener.gzip)} listener.`,
    'You check the second todo. Resumption fetches one handler and one binding.',
    `${code(data.handlerName)} changed ${code(data.writes.join(', '))}. Only that path's code runs.`,
  ];
  const hidden = live ? ' aria-hidden="true"' : '';
  let says = '';
  for (const [index, line] of lines.entries()) {
    says += `<p data-at="${index + 1}"${hidden}>${line}</p>`;
  }
  const announce = live
    ? `<p class="visually-hidden" aria-live="polite" data-says-live>${lines[0]}</p>`
    : '';
  return `<div class="resume-says">${says}${announce}</div>`;
}

function renderRequest(file: DemoFile, label: string, from: number): string {
  return `<li class="request" data-from="${from}"><span class="request-name" title="${escape(label)}">${escape(label)}</span><span class="request-size">${formatBytes(file.gzip)}</span></li>`;
}

/** The requests a lane makes, each shown from the step that makes it. */
function renderNetwork(data: DemoData, lane: Lane): string {
  let rows = `<li class="request-none" data-until="1">No request yet</li>`;
  rows += renderRequest(data.document, 'GET /', 2);
  rows += renderRequest(data.loader, data.loader.name, 2);
  if (lane === 'hydrate') {
    const all: DemoFile = {
      path: '',
      name: '',
      raw: 0,
      gzip: sumGzip(data.chunks),
    };
    rows += renderRequest(all, `${data.chunks.length} chunks`, 2);
    rows += `<li class="request-none" data-from="3">The click makes no request</li>`;
  } else {
    rows += renderRequest(data.handler, data.handler.name, 3);
    rows += renderRequest(data.binding, data.binding.name, 3);
  }
  return `<ul class="requests">${rows}</ul>`;
}

/** The two counters of a lane. The client counts between the values of `data-values`. */
function renderCounters(counts: Counts, step: number): string {
  const js = counts.js[step - 1];
  const runs = counts.runs[step - 1];
  return `<dl class="counters">
  <div><dt>Component JS loaded</dt><dd data-values="${counts.js.join(',')}" data-format="bytes">${formatBytes(js)}</dd></div>
  <div><dt>Component code runs</dt><dd data-values="${counts.runs.join(',')}" data-format="count">${runs}</dd></div>
</dl>`;
}

/**
 * The todo page as blocks. In the hydration lane every block runs code on load (`data-ran`).
 * In both lanes the patch lights the blocks that read `done` (`data-patch`); in the resumption
 * lane the rest stay dim (`data-dim`).
 */
function renderMini(data: DemoData, lane: Lane): string {
  const hydrate = lane === 'hydrate';
  const ran = hydrate ? ' data-ran' : '';
  const dim = hydrate ? '' : ' data-dim';
  const plug = hydrate ? `<span class="mini-plug" data-from="2">${ICON.plug}</span>` : '';
  // The count before and after the click, which flips the second todo.
  let left = 0;
  let after = 0;
  for (const [row, todo] of data.todos.entries()) {
    if (!todo.done) {
      left++;
    }
    if (row === 1 ? todo.done : !todo.done) {
      after++;
    }
  }
  let index = 0;

  // The form and the count come first, as in the app.
  let nodes = `<div class="mini-node"${ran}${dim} style="--i:${index++}"><span class="mini-field"></span><span class="mini-add">Add</span>${plug}</div>`;
  nodes += `<div class="mini-node" data-patch${ran} style="--i:${index++}"><span class="mini-count"><span data-until="3">${left}</span><span data-from="4">${after}</span></span> left</div>`;

  // Each row. The clicked row is the second: its box checks on the click, its style on the patch.
  for (const [row, todo] of data.todos.entries()) {
    const clicked = row === 1;
    const state = clicked ? ' data-patch' : dim;
    let check = '';
    if (todo.done) {
      check = ICON.check;
    } else if (clicked) {
      check = `<span data-from="3">${ICON.check}</span>`;
    }
    const pointer = clicked
      ? `<span class="mini-pointer" data-from="3">${ICON.pointer}</span>`
      : '';
    const done = todo.done ? ' mini-done' : '';
    nodes += `<div class="mini-node${done}"${state}${ran} style="--i:${index++}"><span class="mini-check">${check}</span><span class="mini-text">${escape(todo.text)}</span>${plug}${pointer}</div>`;
  }

  // Resumption keeps one listener on the document and the state encoded until the click.
  let chips = '';
  if (!hydrate) {
    chips = `<div class="chips"><span class="chip" data-from="2">${ICON.plug} document listener</span><span class="chip-stack"><span class="chip" data-from="2" data-until="2">${ICON.lock} state encoded</span><span class="chip" data-from="3">${ICON.open} state decoded</span></span></div>`;
  }
  return `<div class="mini" data-from="2">${chips}${nodes}</div>`;
}

function renderLane(data: DemoData, lane: Lane, counts: Counts, step: number): string {
  const name = lane === 'hydrate' ? 'Hydration' : 'Resumption';
  const what = lane === 'hydrate' ? 'Most frameworks' : 'idlip';
  return `<div class="lane lane-${lane}">
  <div class="lane-head"><div><h3>${name}</h3><p>${what}</p></div>${renderCounters(counts, step)}</div>
  <div class="stations">
    <div class="station station-server"><h4>Server</h4><p>${formatBytes(data.document.gzip)} of HTML</p></div>
    <div class="station station-net"><h4>Network</h4>${renderNetwork(data, lane)}</div>
    <div class="station station-browser"><h4>Browser</h4>${renderMini(data, lane)}</div>
  </div>
</div>`;
}

interface Mark {
  text: string;
  /** The steps that light the mark, such as `3` or `1 2`. Empty for dimmed text. */
  lit: string;
}

const renderer = createRenderer();

/**
 * Highlights a piece of the code. A piece that starts with `<` is HTML and the rest is the
 * script. The edges stay plain text, so the line breaks and the indent around a piece survive.
 */
function highlight(text: string): string {
  const core = text.trim();
  if (core === '') {
    return escape(text);
  }
  const start = text.indexOf(core);
  const language = core.startsWith('<') ? 'html' : 'js';
  const env: RenderEnv = { headings: [], lead: '', link: (href) => href };
  const block = renderer.render(`\`\`\`${language}\n${core}\n\`\`\`\n`, env);
  const inner = /<code[^>]*>([\s\S]*)<\/code>/.exec(block)?.[1];
  if (inner === undefined) {
    return escape(text);
  }
  return `${escape(text.slice(0, start))}${inner.replace(/\n$/, '')}${escape(text.slice(start + core.length))}`;
}

/** Highlights text and wraps each mark, found in order, in a `<mark>` lit at its steps. */
function markText(text: string, marks: readonly Mark[]): string {
  let html = '';
  let cursor = 0;
  for (const mark of marks) {
    const at = text.indexOf(mark.text, cursor);
    if (at === -1) {
      continue;
    }
    html += highlight(text.slice(cursor, at));
    const inner = highlight(mark.text);
    html +=
      mark.lit === ''
        ? `<span class="code-dim">${inner}</span>`
        : `<mark class="code-mark" data-lit="${mark.lit}">${inner}</mark>`;
    cursor = at + mark.text.length;
  }
  return html + highlight(text.slice(cursor));
}

/** The markup of the second todo and the state script, with the part each step reads lit. */
function renderCode(data: DemoData): string {
  // One element per line, as in website/docs/resuming.md.
  const row = data.row
    .replace(/^(<li[^>]*>)/, '$1\n  ')
    .replace(/(<!--t\d+-->)/, '\n  $1')
    .replace(/<\/li>$/, '\n</li>');
  const rowMarks: Mark[] = [];
  for (const match of data.row.matchAll(/i-a="[^"]*"|on:click='[^']*'/g)) {
    rowMarks.push({ text: match[0], lit: match[0].startsWith('on:') ? '3' : '4' });
  }

  // The state script, with the manifest and the chunk URLs folded into a comment.
  const state = data.state;
  const open = /^<script i-state[^>]*>/.exec(state)?.[0] ?? '';
  const events = /"([a-z ]+)"/.exec(state)?.[0] ?? '';
  const model = state.indexOf('model:');
  const head = state.slice(0, state.indexOf(events) + events.length);
  const folded = state.slice(head.length, model);
  const tail = state.slice(model);
  const modelText = /^model:\{[\s\S]*?\},props:/.exec(tail)?.[0].slice(0, -',props:'.length) ?? '';
  const stateText = `${head}\n  /* manifest and chunk URLs, ${folded.length} B */\n  ${tail}`;
  const stateMarks: Mark[] = [
    { text: open, lit: '1 2' },
    { text: events, lit: '2' },
    { text: `/* manifest and chunk URLs, ${folded.length} B */`, lit: '' },
    { text: modelText, lit: '3' },
  ];

  return `<div class="tile resume-code">
  <h3 class="resume-code-head">The HTML of the second todo</h3>
  <pre tabindex="0" role="group" aria-label="Server HTML"><code>${markText(row, rowMarks)}\n\n${markText(stateText, stateMarks)}</code></pre>
</div>`;
}

function renderLegend(): string {
  return `<ul class="legend">
  <li><span class="swatch swatch-html"></span>Only HTML</li>
  <li><span class="swatch swatch-ran"></span>Ran component code</li>
  <li><span class="swatch swatch-patch"></span>Patched after the click</li>
</ul>`;
}

/** One stage at one step. The interactive stage starts at step 1 and the client moves it. */
function renderStage(data: DemoData, step: number, controls: string): string {
  const counts = countSteps(data);
  return `<figure class="resume-stage" data-step="${step}">
  ${controls}
  <div class="resume-top">
    ${renderSays(data, controls !== '')}
    ${renderCode(data)}
  </div>
  <div class="lanes">
    ${renderLane(data, 'hydrate', counts.hydrate, step)}
    ${renderLane(data, 'resume', counts.resume, step)}
  </div>
  ${renderLegend()}
  <p class="resume-note">Hydration is modeled, not measured.</p>
</figure>`;
}

function renderControls(): string {
  let tabs = '';
  for (const [index, label] of STEPS.entries()) {
    const current = index === 0 ? ' aria-current="step"' : '';
    tabs += `<button class="step-tab" type="button" data-go="${index + 1}"${current}><span class="step-num">${index + 1}</span>${label}</button>`;
  }
  return `<div class="resume-bar">
  <div class="step-tabs" role="group" aria-label="Steps">${tabs}</div>
  <div class="step-arrows">
    <button class="icon-button" type="button" data-prev aria-label="Previous step" title="Previous step" disabled>${ICON.back}</button>
    <button class="icon-button" type="button" data-next aria-label="Next step" title="Next step">${ICON.arrow}</button>
  </div>
</div>`;
}

/**
 * The resume diagram: a stepper the reader moves with the buttons or by scrolling, and the same
 * four steps as static panels, which replace it when motion is reduced.
 */
export function renderResume(data: DemoData): string {
  let sequence = '';
  for (const [index, label] of STEPS.entries()) {
    sequence += `<li><h3 class="sequence-title">Step ${index + 1}. ${label}</h3>${renderStage(data, index + 1, '')}</li>`;
  }
  return `<section class="resume" aria-labelledby="resume-title">
  <h2 class="row-title" id="resume-title">Hydration and resumption</h2>
  <p class="row-lead">Same todo app, two ways to make it respond.</p>
  <div class="resume-track" data-resume>${renderStage(data, 1, renderControls())}</div>
  <ol class="resume-sequence">${sequence}</ol>
</section>`;
}
