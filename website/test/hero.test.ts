// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { STILL_AT, STORY_AT, renderHeroStage, shortenChunk } from '../src/landing/hero.ts';

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
  chunks: [],
  handlerName: 'toggle',
  token: '["toggle",["a2"]]',
  writes: ['todos.*.done'],
  row: '',
  state: '<script i-state>(self.$idlip||=[]).push([])</script>',
  todos: [
    { text: 'One', done: true },
    { text: 'Two <b>', done: false },
  ],
};

const html = renderHeroStage(demo);
const css = readFileSync(join(import.meta.dirname, '../src/styles.css'), 'utf8');

/** The stage as the browser parses it. */
function mount(markup = html): HTMLElement {
  document.body.innerHTML = markup;
  const stage = document.querySelector<HTMLElement>('[data-hero]');
  if (!stage) {
    throw new Error('no stage');
  }
  return stage;
}

describe('the hero picture', () => {
  it('shows the names and sizes of the demo build', () => {
    const stage = mount();
    const net = stage.querySelector('.hero-net');
    expect(net?.textContent).toBe('loader.js 3.9 kB');
    const chips = [...stage.querySelectorAll('.hero-chip')];
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'toggle.js 119 B',
      'todos._.done.js 505 B',
    ]);
    // The short names keep the full ones in the tooltip.
    expect(chips.map((chip) => chip.getAttribute('title'))).toEqual([
      'todo.handler.toggle.js',
      'todo.binding.todos._.done.js',
    ]);
    const values = [...stage.querySelectorAll('.hero-vals > span')];
    expect(values.map((value) => value.textContent)).toEqual(['0 B', '119 B', '624 B']);
  });

  it('shows the message, the changed path and the state tag of the demo', () => {
    const stage = mount();
    expect(stage.querySelector('.s-update .hero-step-body')?.textContent).toBe('["toggle",["a2"]]');
    expect(stage.querySelector('.s-model .hero-path')?.textContent).toBe('todos[1].done');
    expect(stage.querySelector('.v-was')?.textContent).toBe('false');
    expect(stage.querySelector('.v-now')?.textContent).toBe('true');
    expect(stage.querySelector('.s-view .hero-path')?.textContent).toBe('row a2, count');
    expect(stage.querySelector('.hero-seal code')?.textContent).toBe('<script i-state>');
  });

  it('writes the slider texts and the live lines from the demo', () => {
    const stage = mount();
    const story: unknown = JSON.parse(stage.dataset.story ?? '');
    expect(story).toMatchObject({
      at: STORY_AT,
      still: STILL_AT,
      live: {
        first:
          'Loaded todo.handler.toggle.js, 119 B, and todo.binding.todos._.done.js, 505 B. One row and the count changed.',
        later: 'Already loaded.',
      },
    });
    expect(JSON.stringify(story)).toContain('Page loaded with loader.js, 3.9 kB.');
    expect(JSON.stringify(story)).toContain('Model: todos[1].done turns true');
  });

  it('draws the still frame without the script', () => {
    const stage = mount();
    expect(stage.classList.contains('on-patch')).toBe(true);
    expect(stage.classList.contains('on-unfold')).toBe(true);
    expect(stage.classList.contains('on-fold')).toBe(false);
    expect(stage.style.getPropertyValue('--t')).toBe(String(STILL_AT));
    const inputs = [...stage.querySelectorAll('input')];
    expect(inputs.map((input) => input.checked)).toEqual([true, true]);
    expect(inputs.map((input) => input.disabled)).toEqual([true, true]);
    expect(stage.querySelector('[data-left]')?.textContent).toBe('0');
    const knob = stage.querySelector('.hero-knob');
    expect(knob?.getAttribute('role')).toBe('slider');
    expect(knob?.hasAttribute('disabled')).toBe(true);
    expect(knob?.getAttribute('aria-valuenow')).toBe('74');
    expect(knob?.getAttribute('aria-valuetext')).toBe(
      'One row and the count changed. 624 B of component code loaded',
    );
  });

  it('says the picture is a model and has one polite live line', () => {
    expect(html).toContain('A model of the todo demo build. Nothing is fetched.');
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain('<i class="hero-cached">cached</i>');
    expect(html).toMatch(/<div class="hero-tl-head" aria-hidden="true">/);
  });

  it('escapes the todo text and the attribute JSON', () => {
    expect(html).toContain('Two &lt;b&gt;');
    expect(html).not.toContain('Two <b>');
    const odd = renderHeroStage({
      ...demo,
      handler: makeFile('todo.handler.say"<x>.js', 119),
    });
    expect(odd).not.toContain('say"<x>');
    const stage = mount(odd);
    expect(stage.dataset.story).toContain('todo.handler.say\\"<x>.js');
  });

  it('shortens chunk names by their module and kind', () => {
    expect(shortenChunk('todo.handler.toggle.js')).toBe('toggle.js');
    expect(shortenChunk('todo.binding.todos._.done.js')).toBe('todos._.done.js');
    expect(shortenChunk('loader.js')).toBe('loader.js');
  });

  it('hides the page until the script runs, and settles by itself', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.js \.hero-stage:not\(\[data-live\]\) :is\(\.hero-page, \.hero-net, \.hero-track, \.hero-tl-value\) \{\s*opacity: 0;\s*animation: hero-settle 1ms 3\.5s forwards;/,
    );
    expect(css).toContain('@keyframes hero-settle');
  });
});

type Watch = (entries: { isIntersecting: boolean }[]) => void;

let watch: Watch | undefined;

/** Mounts the stage and runs `hero.ts` against it with motion `reduced` or not. */
async function load(reduced: boolean): Promise<HTMLElement> {
  const stage = mount();
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) =>
    setTimeout(() => {
      callback(Date.now());
    }, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => {
    clearTimeout(id);
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: Watch) {
        watch = callback;
      }

      observe = vi.fn();
    },
  );
  vi.resetModules();
  await import('../src/client/hero.ts');
  return stage;
}

/** The time of the story, from the `--t` the script wrote. */
function readTime(stage: HTMLElement): number {
  return Number(stage.style.getPropertyValue('--t'));
}

function getInputs(stage: HTMLElement): HTMLInputElement[] {
  return [...stage.querySelectorAll('input')];
}

/** Runs the story for `share` of its 8 seconds. */
function play(share: number): void {
  vi.advanceTimersByTime(share * 8000);
}

describe('the hero script', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    watch = undefined;
  });

  it('plays the phases in order and clicks the todo by itself', async () => {
    const stage = await load(false);
    expect(stage.dataset.live).toBe('');
    expect(readTime(stage)).toBe(0);
    expect(stage.classList.contains('on-load')).toBe(false);
    expect(stage.dataset.step).toBe('render');
    expect(getInputs(stage).map((input) => input.checked)).toEqual([true, false]);
    expect(getInputs(stage)[1].disabled).toBe(false);

    // The page loads: the loader is in, no component code yet.
    play(STORY_AT.load + 0.02);
    expect(stage.classList.contains('on-load')).toBe(true);
    expect(stage.classList.contains('on-click')).toBe(false);
    expect(stage.dataset.step).toBe('load');

    // The click: Update, then Model, then View, then the row and the count change.
    play(STORY_AT.update - STORY_AT.load);
    expect(stage.classList.contains('on-update')).toBe(true);
    expect(stage.classList.contains('on-view')).toBe(false);
    expect(getInputs(stage)[1].checked).toBe(false);
    play(STORY_AT.patch - STORY_AT.update + 0.01);
    expect(stage.classList.contains('on-view')).toBe(true);
    expect(stage.classList.contains('on-patch')).toBe(true);
    expect(getInputs(stage)[1].checked).toBe(true);
    expect(stage.querySelector('[data-left]')?.textContent).toBe('0');
    expect(stage.querySelector('[data-hero-live]')?.textContent).toContain(
      'Loaded todo.handler.toggle.js, 119 B',
    );

    // The loop folds and the story stops at the end.
    play(0.5);
    expect(readTime(stage)).toBe(1);
    expect(stage.classList.contains('on-fold')).toBe(true);
    play(1);
    expect(readTime(stage)).toBe(1);
  });

  it.each(['focusin', 'pointerenter', 'pointerdown'])(
    'never clicks by itself after %s',
    async (type) => {
      const stage = await load(false);
      play(0.1);
      stage.dispatchEvent(new Event(type));
      play(2);
      // It waits at the pointer's moment, before the click.
      expect(readTime(stage)).toBeCloseTo(STORY_AT.aim, 2);
      expect(stage.classList.contains('on-click')).toBe(false);
      expect(Number(stage.style.getPropertyValue('--pointer'))).toBe(0);
      expect(getInputs(stage)[1].checked).toBe(false);

      // The visitor's own click runs the loop.
      getInputs(stage)[1].click();
      play(0.4);
      expect(stage.classList.contains('on-patch')).toBe(true);
      expect(getInputs(stage)[1].checked).toBe(true);
      expect(stage.querySelector('[data-hero-live]')?.textContent).toContain('Loaded');
    },
  );

  it('takes no click before the loader and none on the other todo before the loop', async () => {
    const stage = await load(false);
    stage.dispatchEvent(new Event('pointerenter'));
    getInputs(stage)[1].click();
    expect(getInputs(stage)[1].checked).toBe(false);
    expect(stage.classList.contains('on-click')).toBe(false);
    play(1);
    getInputs(stage)[0].click();
    expect(getInputs(stage)[0].checked).toBe(true);
    expect(stage.classList.contains('on-click')).toBe(false);
  });

  it('serves later clicks from the cache', async () => {
    const stage = await load(false);
    play(1.1);
    const cached = stage.querySelector('.hero-cached');
    getInputs(stage)[0].click();
    expect(getInputs(stage)[0].checked).toBe(false);
    expect(stage.querySelector('[data-left]')?.textContent).toBe('1');
    expect(stage.querySelector('[data-hero-live]')?.textContent).toBe('Already loaded.');
    expect(cached?.classList.contains('is-hit')).toBe(true);
    expect(stage.querySelector('[data-row]')?.classList.contains('is-hit')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(cached?.classList.contains('is-hit')).toBe(false);
  });

  it('pauses off screen and goes on when back', async () => {
    const stage = await load(false);
    play(0.1);
    watch?.([{ isIntersecting: false }]);
    const paused = readTime(stage);
    play(1);
    expect(readTime(stage)).toBe(paused);
    watch?.([{ isIntersecting: true }]);
    play(0.2);
    expect(readTime(stage)).toBeGreaterThan(paused);
  });

  it('moves with the arrow keys, Home and End, and says where it is', async () => {
    const stage = await load(false);
    play(0.5);
    const knob = stage.querySelector<HTMLButtonElement>('.hero-knob');
    expect(knob?.disabled).toBe(false);
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(knob?.getAttribute('aria-valuenow')).toBe('0');
    expect(knob?.getAttribute('aria-valuetext')).toBe('The server renders the page');
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(knob?.getAttribute('aria-valuenow')).toBe('2');
    // A key stops the story where it is.
    play(1);
    expect(knob?.getAttribute('aria-valuenow')).toBe('2');
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(readTime(stage)).toBe(1);
    knob?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(knob?.getAttribute('aria-valuenow')).toBe('98');
    expect(getInputs(stage)[1].checked).toBe(true);
  });

  it('stays at the still frame with reduced motion, and clicks show the cache', async () => {
    const stage = await load(true);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(stage.classList.contains('on-patch')).toBe(true);
    play(2);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(getInputs(stage).map((input) => input.disabled)).toEqual([false, false]);
    getInputs(stage)[1].click();
    expect(getInputs(stage)[1].checked).toBe(false);
    expect(stage.querySelector('[data-hero-live]')?.textContent).toBe('Already loaded.');
    expect(stage.querySelector('.hero-cached')?.classList.contains('is-hit')).toBe(true);
  });
});
