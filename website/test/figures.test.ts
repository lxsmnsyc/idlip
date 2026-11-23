// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { renderFigure, stripFigures } from '../src/figures/index.ts';
import { FIGURE_NAMES } from '../src/figures/names.ts';
import type { FigureName } from '../src/figures/names.ts';
import { startFigure } from '../src/figures/player.ts';
import { formatBytes } from '../src/landing/format.ts';
import { createRenderer } from '../src/markdown.ts';
import type { RenderEnv } from '../src/markdown.ts';

function makeFile(name: string, gzip: number): DemoFile {
  return { path: `demo/assets/${name}`, name, raw: gzip * 2, gzip };
}

const demo: DemoData = {
  frame: 'demo/',
  document: makeFile('demo/', 2100),
  listener: makeFile('listener', 991),
  loader: makeFile('loader.js', 3881),
  handler: makeFile('todo.handler.toggle.js', 119),
  binding: makeFile('todo.binding.todos._.done.js', 505),
  helpers: makeFile('_idlip-helpers.js', 928),
  chunks: [],
  handlerName: 'toggle',
  token: '["toggle",["a2"]]',
  writes: ['todos.*.done'],
  row: '<li i-a="4"><input type="checkbox" on:click=\'["toggle",["a2"]]\' i-a="5 7"><!--t6-->Two &lt;b&gt;<!--/t--></li>',
  state: '<script i-state>(self.$idlip||=[]).push([])</script>',
  todos: [
    { id: 'a1', text: 'One', done: true },
    { id: 'a2', text: 'Two <b>', done: false },
  ],
};

/** The demo build the website build writes, when it has run. */
const BUILT = join(import.meta.dirname, '../dist/demo-server/demo.json');

function isDemoData(value: unknown): value is DemoData {
  return typeof value === 'object' && value !== null && 'token' in value && 'todos' in value;
}

function mount(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  const root = document.querySelector<HTMLElement>('[data-figure]');
  if (!root) {
    throw new Error('no figure');
  }
  return root;
}

function readTexts(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((element) => element.textContent);
}

function render(
  markdown: string,
  figure?: (name: FigureName) => string,
  file = 'docs/a.md',
): string {
  const env: RenderEnv = { headings: [], lead: '', link: (href) => href, file };
  return createRenderer({ figure }).render(markdown, env);
}

describe('the figure fence', () => {
  it('renders the named figure', () => {
    const html = render('Text.\n\n```figure mvu-loop\n```\n', (name) => `<figure>${name}</figure>`);
    expect(html).toContain('<figure>mvu-loop</figure>');
    expect(html).not.toContain('code-block');
  });

  it('fails the build on an unknown name, with the file and line', () => {
    expect(() => render('Text.\n\n```figure page-wake\n```\n')).toThrow(
      'docs/a.md:3: unknown figure "page-wake". Figures: mvu-loop, message-trace.',
    );
    expect(() => render('```figure\n```\n')).toThrow('unknown figure ""');
  });

  it('takes no body', () => {
    expect(() => render('```figure mvu-loop\nhello\n```\n')).toThrow(
      'docs/a.md:1: a figure fence has no body.',
    );
  });

  it('renders an empty figure without the demo build', () => {
    expect(render('```figure message-trace\n```\n')).toBe(
      '<figure class="fig" data-figure="message-trace"></figure>\n',
    );
  });
});

describe('the static figures', () => {
  for (const name of FIGURE_NAMES) {
    it(`${name} is the last step, with a disabled checkbox and a caption`, () => {
      const root = mount(renderFigure(name, demo));
      const story: unknown = JSON.parse(root.dataset.story ?? '');
      const steps: unknown = Reflect.get(Object(story), 'steps');
      expect(Array.isArray(steps)).toBe(true);
      // Every step is on, so the page shows the end of the story without the script.
      for (const step of Array.isArray(steps) ? steps : []) {
        expect(root.classList.contains(`on-${String(Reflect.get(Object(step), 'id'))}`)).toBe(true);
      }
      expect(root.dataset.step).toBe('patch');
      const toggle = root.querySelector<HTMLInputElement>('[data-figure-toggle]');
      expect(toggle?.disabled).toBe(true);
      expect(toggle?.checked).toBe(true);
      expect(toggle?.closest('label')?.textContent).toBe('Two <b>');
      expect(root.querySelector<HTMLElement>('[data-figure-replay]')?.hidden).toBe(true);
      expect(root.querySelectorAll('figcaption')).toHaveLength(1);
      // One sentence.
      const caption = root.querySelector('figcaption')?.textContent ?? '';
      expect(caption).toMatch(/^[A-Z].*\.$/);
      expect(caption).not.toMatch(/\. [A-Z]/);
      // The count goes from 1 left to 0 left, and the meter from 0 B to the click's total.
      expect(readTexts(root, '.fig-count .fig-swap > span')).toEqual(['1', '0']);
      expect(readTexts(root, '.fig-meter-value > span')).toEqual(['0 B', '1.0 kB', '1.6 kB']);
    });
  }

  it('the MVU loop shows the model, the chunks and the state script', () => {
    const root = mount(renderFigure('mvu-loop', demo));
    expect(readTexts(root, '.fig-chip')).toEqual([
      'toggle.js 119 B',
      '_idlip-helpers.js 928 B',
      'todos._.done.js 505 B',
    ]);
    expect(readTexts(root, '.fig-key')).toEqual(['todos[0].done', 'todos[1].done']);
    expect(readTexts(root, '.fig-val > span')).toEqual(['false', 'true']);
    expect(root.querySelector('.fig-capsule')?.textContent).toBe('<script i-state>');
    expect(root.querySelector('.fig-call .fig-now')?.textContent).toBe('toggle("a2")');
  });

  it('the trace shows the markup, each chunk and the targets', () => {
    const root = mount(renderFigure('message-trace', demo));
    expect(root.querySelector('.fig-code')?.textContent).toBe(
      '<input\n  type="checkbox"\n  on:click=\n    \'["toggle",["a2"]]\'\n  i-a="5 7">',
    );
    expect(root.querySelector('.fig-msg')?.textContent).toBe('\'["toggle",["a2"]]\'');
    expect(readTexts(root, '.fig-file')).toEqual([
      'todo.handler.toggle.js',
      '_idlip-helpers.js',
      '<script i-state> in the page',
      'todo.binding.todos._.done.js',
    ]);
    expect(readTexts(root, '.fig-size .fig-now')).toEqual(['119 B', '928 B', '505 B']);
    expect(root.querySelector('.fig-path')?.textContent).toBe('todos.*.done');
    expect(readTexts(root, '.c-model .fig-key')).toEqual(['todos[1].done']);
    expect(readTexts(root, '.fig-target')).toEqual(['row a2', 'count']);
  });

  it('fails when the row has no checkbox with the message', () => {
    expect(() => renderFigure('message-trace', { ...demo, row: '<li></li>' })).toThrow(
      'no checkbox with the message',
    );
  });

  it('leaves only the caption in the search text', () => {
    const html = `<p>Before.</p>${renderFigure('message-trace', demo)}<p>After.</p>`;
    const stripped = stripFigures(html);
    expect(stripped).toContain('<p>Before.</p><p>The message on the checkbox');
    expect(stripped).not.toContain('fig-well');
    expect(stripped).toContain('<p>After.</p>');
  });

  it.runIf(existsSync(BUILT))('shows the numbers of the demo build on the docs pages', () => {
    const parsed: unknown = JSON.parse(readFileSync(BUILT, 'utf8'));
    if (!isDemoData(parsed)) {
      throw new TypeError('demo.json has the wrong shape');
    }
    const built = parsed;
    const files = built.helpers
      ? [built.handler, built.helpers, built.binding]
      : [built.handler, built.binding];
    let total = 0;
    for (const file of files) {
      total += file.gzip;
    }
    const where = new Map([
      ['components.md', 'mvu-loop'],
      ['resuming.md', 'message-trace'],
    ]);
    for (const [file, name] of where) {
      const source = readFileSync(join(import.meta.dirname, '../docs', file), 'utf8');
      const html = render(source, (figure) => renderFigure(figure, built), `docs/${file}`);
      const root = mount(html);
      expect(root.dataset.figure).toBe(name);
      expect(root.querySelector('.fig-v2')?.textContent).toBe(formatBytes(total));
      expect(root.textContent).toContain(formatBytes(built.binding.gzip));
      expect(root.textContent).toContain(built.handlerName);
    }
  });
});

type Watch = (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void;

describe('the figure player', () => {
  let watch: Watch | undefined;

  function start(reduced: boolean, name: FigureName = 'message-trace'): HTMLElement {
    const root = mount(renderFigure(name, demo));
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: Watch) {
          watch = callback;
        }

        observe = vi.fn();
      },
    );
    startFigure(root);
    return root;
  }

  function see(ratio: number): void {
    watch?.([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  }

  function getToggle(root: HTMLElement): HTMLInputElement {
    const toggle = root.querySelector<HTMLInputElement>('[data-figure-toggle]');
    if (!toggle) {
      throw new Error('no toggle');
    }
    return toggle;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    watch = undefined;
  });

  it('waits at the first step until in view, then plays to the end and stops', () => {
    const root = start(false);
    expect(root.dataset.step).toBe('start');
    expect(root.classList.contains('on-press')).toBe(false);
    expect(getToggle(root).checked).toBe(false);
    expect(getToggle(root).disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-figure-replay]')?.hidden).toBe(false);

    // Not enough of it shows: it waits.
    see(0.1);
    vi.advanceTimersByTime(3000);
    expect(root.dataset.step).toBe('start');

    see(1);
    vi.advanceTimersByTime(500 + 700 + 200);
    expect(root.dataset.step).toBe('send');
    expect(root.classList.contains('on-press')).toBe(true);
    vi.advanceTimersByTime(1000 + 1000 + 900);
    expect(root.dataset.step).toBe('patch');
    expect(getToggle(root).checked).toBe(true);
    expect(root.querySelector('[data-figure-live]')?.textContent).toBe(
      'Loaded todo.handler.toggle.js, 119 B, _idlip-helpers.js, 928 B and todo.binding.todos._.done.js, 505 B: 1.6 kB. One row and the count changed.',
    );
    vi.advanceTimersByTime(10_000);
    expect(root.dataset.step).toBe('patch');
  });

  it('pauses off screen and goes on where it was', () => {
    const root = start(false);
    see(1);
    vi.advanceTimersByTime(500 + 300);
    expect(root.dataset.step).toBe('aim');
    see(0);
    vi.advanceTimersByTime(5000);
    expect(root.dataset.step).toBe('aim');
    see(1);
    vi.advanceTimersByTime(350);
    expect(root.dataset.step).toBe('aim');
    vi.advanceTimersByTime(100);
    expect(root.dataset.step).toBe('press');
  });

  it('plays the click from the row, ignores clicks while it runs, and replays it cached after', () => {
    const root = start(false);
    see(1);
    const toggle = getToggle(root);
    const live = root.querySelector('[data-figure-live]');
    toggle.click();
    expect(root.dataset.step).toBe('press');
    expect(root.classList.contains('is-hands')).toBe(true);
    expect(root.classList.contains('is-cached')).toBe(false);
    expect(toggle.checked).toBe(false);
    vi.advanceTimersByTime(300);
    toggle.click();
    expect(root.dataset.step).toBe('send');
    expect(toggle.checked).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(root.dataset.step).toBe('patch');
    expect(toggle.checked).toBe(true);

    // A later click replays Update, Model and the patch with the chunks cached. The row goes back.
    toggle.click();
    expect(root.dataset.step).toBe('press');
    expect(root.classList.contains('is-cached')).toBe(true);
    expect(root.classList.contains('is-flipped')).toBe(true);
    expect(toggle.checked).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(root.dataset.step).toBe('patch');
    expect(toggle.checked).toBe(false);
    expect(live?.textContent).toBe('Already loaded. Two <b> is marked not done.');

    // The next one changes it again.
    toggle.click();
    expect(root.classList.contains('is-flipped')).toBe(false);
    expect(root.classList.contains('is-cached')).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(toggle.checked).toBe(true);
    expect(live?.textContent).toBe('Already loaded. Two <b> is marked done.');
  });

  it('clears the live line before it repeats the same text', () => {
    const root = start(false, 'mvu-loop');
    const live = root.querySelector('[data-figure-live]');
    see(1);
    vi.advanceTimersByTime(20_000);
    const loaded = live?.textContent;
    expect(loaded).toMatch(/^Loaded /);
    root.querySelector<HTMLButtonElement>('[data-figure-replay]')?.click();
    vi.advanceTimersByTime(6900);
    expect(root.dataset.step).toBe('patch');
    expect(live?.textContent).toBe('');
    vi.advanceTimersByTime(100);
    expect(live?.textContent).toBe(loaded);
  });

  it('replays from the first step', () => {
    const root = start(false, 'mvu-loop');
    see(1);
    vi.advanceTimersByTime(20_000);
    expect(root.dataset.step).toBe('patch');
    root.querySelector<HTMLButtonElement>('[data-figure-replay]')?.click();
    expect(root.dataset.step).toBe('start');
    expect(root.classList.contains('on-render')).toBe(false);
    expect(root.classList.contains('is-cached')).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(root.dataset.step).toBe('patch');
  });

  it('stays at the end with reduced motion, and the row still toggles', () => {
    const root = start(true, 'mvu-loop');
    expect(root.dataset.step).toBe('patch');
    expect(root.querySelector<HTMLElement>('[data-figure-replay]')?.hidden).toBe(true);
    const toggle = getToggle(root);
    expect(toggle.disabled).toBe(false);
    toggle.click();
    expect(root.dataset.step).toBe('patch');
    expect(root.classList.contains('is-flipped')).toBe(true);
    expect(toggle.checked).toBe(false);
    toggle.click();
    expect(root.dataset.step).toBe('patch');
    expect(toggle.checked).toBe(true);
  });
});
