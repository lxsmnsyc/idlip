// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { formatBytes } from '../src/landing/format.ts';
import {
  STILL_AT,
  STORY_AT,
  findClicked,
  renderHeroStage,
  shortenChunk,
} from '../src/landing/hero.ts';

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
  row: '',
  state: '<script i-state>(self.$idlip||=[]).push([])</script>',
  todos: [
    { id: 'a1', text: 'One', done: true },
    { id: 'a2', text: 'Two <b>', done: false },
  ],
};

const html = renderHeroStage(demo);

/** The demo build the website build writes, when it has run. */
const BUILT = join(import.meta.dirname, '../dist/demo-server/demo.json');

/** The stage as the browser parses it. */
function mount(markup = html): HTMLElement {
  document.body.innerHTML = markup;
  const stage = document.querySelector<HTMLElement>('[data-hero]');
  if (!stage) {
    throw new Error('no stage');
  }
  return stage;
}

function isDemoData(value: unknown): value is DemoData {
  return typeof value === 'object' && value !== null && 'token' in value && 'todos' in value;
}

function readTexts(stage: HTMLElement, selector: string): (string | null)[] {
  return [...stage.querySelectorAll(selector)].map((element) => element.textContent);
}

describe('the hero picture', () => {
  it('shows the names and sizes of the demo build', () => {
    const stage = mount();
    expect(stage.querySelector('.hero-net')?.textContent).toBe('loader.js 3.9 kB');
    expect(readTexts(stage, '.hero-chip')).toEqual([
      'toggle.js 119 B',
      '_idlip-helpers.js 928 B',
      'todos._.done.js 505 B',
    ]);
    // The short names keep the full ones in the tooltip.
    const titles = [...stage.querySelectorAll('.hero-chip')].map((chip) =>
      chip.getAttribute('title'),
    );
    expect(titles).toEqual([
      'todo.handler.toggle.js',
      '_idlip-helpers.js',
      'todo.binding.todos._.done.js',
    ]);
    // The click loads the handler and the helpers, then the binding.
    expect(readTexts(stage, '.hero-vals > span')).toEqual(['0 B', '1.0 kB', '1.6 kB']);
  });

  it('leaves the helpers out when the build has none', () => {
    const stage = mount(renderHeroStage({ ...demo, helpers: undefined }));
    expect(readTexts(stage, '.hero-chip')).toEqual(['toggle.js 119 B', 'todos._.done.js 505 B']);
    expect(readTexts(stage, '.hero-vals > span')).toEqual(['0 B', '119 B', '624 B']);
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

  it('flips the todo the message names', () => {
    expect(findClicked(demo)).toBe(1);
    const swapped = { ...demo, todos: [demo.todos[1], demo.todos[0]] };
    expect(findClicked(swapped)).toBe(0);
    expect(
      mount(renderHeroStage(swapped)).querySelector('[data-target] .hero-text')?.textContent,
    ).toBe('Two <b>');
    expect(() => findClicked({ ...demo, token: '["toggle",["a9"]]' })).toThrow(/a9/);
  });

  it('writes the slider texts and the live lines from the demo', () => {
    const stage = mount();
    const story: unknown = JSON.parse(stage.dataset.story ?? '');
    expect(story).toMatchObject({
      at: STORY_AT,
      still: STILL_AT,
      live: {
        first:
          'Loaded todo.handler.toggle.js, 119 B, _idlip-helpers.js, 928 B and todo.binding.todos._.done.js, 505 B: 1.6 kB. One row and the count changed.',
        later: 'Already loaded.',
      },
    });
    const text = JSON.stringify(story);
    expect(text).toContain('Page loaded with loader.js, 3.9 kB.');
    expect(text).toContain(
      'Update loads todo.handler.toggle.js, 119 B and _idlip-helpers.js, 928 B',
    );
    expect(text).toContain('Model: todos[1].done turns true');
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
      'One row and the count changed. The click loaded 1.6 kB',
    );
  });

  it('says the picture is a model and has one polite live line', () => {
    expect(html).toContain('A model of the todo demo build. Nothing is fetched.');
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain('<i class="hero-cached">cached</i>');
    expect(html).toContain('<span class="hero-cue" aria-hidden="true">Click it</span>');
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
    expect(shortenChunk('_idlip-helpers.js')).toBe('_idlip-helpers.js');
  });

  it.skipIf(!existsSync(BUILT))('matches the real demo build', () => {
    const parsed: unknown = JSON.parse(readFileSync(BUILT, 'utf8'));
    if (!isDemoData(parsed)) {
      throw new TypeError('demo.json has the wrong shape');
    }
    const built = parsed;
    const stage = mount(renderHeroStage(built));
    expect(stage.querySelector('.hero-net')?.textContent).toBe(
      `${built.loader.name} ${formatBytes(built.loader.gzip)}`,
    );
    const files = built.helpers
      ? [built.handler, built.helpers, built.binding]
      : [built.handler, built.binding];
    const names: string[] = [];
    let total = 0;
    for (const file of files) {
      names.push(file.name);
      total += file.gzip;
    }
    const titles = [...stage.querySelectorAll('.hero-chip')].map((chip) =>
      chip.getAttribute('title'),
    );
    expect(titles).toEqual(names);
    expect(stage.querySelector('.hero-vals .v2')?.textContent).toBe(formatBytes(total));
    // The build has the shared helpers, and the row the message names is the one that flips.
    expect(built.helpers?.name).toBe('_idlip-helpers.js');
    expect(JSON.parse(built.token)).toEqual([
      built.handlerName,
      [built.todos[findClicked(built)].id],
    ]);
    expect(stage.querySelector('.s-update .hero-step-body')?.textContent).toBe(built.token);
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

function getKnob(stage: HTMLElement): HTMLButtonElement {
  const knob = stage.querySelector<HTMLButtonElement>('.hero-knob');
  if (!knob) {
    throw new Error('no knob');
  }
  return knob;
}

function press(stage: HTMLElement, key: string): void {
  getKnob(stage).dispatchEvent(new KeyboardEvent('keydown', { key }));
}

/** Runs the story for `share` of its 8 seconds. */
function play(share: number): void {
  vi.advanceTimersByTime(share * 8000);
}

function hasClass(stage: HTMLElement, name: string): boolean {
  return stage.classList.contains(name);
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

  it('plays the phases in order, clicks by itself and stops at the still frame', async () => {
    const stage = await load(false);
    expect(stage.dataset.live).toBe('');
    expect(readTime(stage)).toBe(0);
    expect(hasClass(stage, 'on-load')).toBe(false);
    expect(stage.dataset.step).toBe('render');
    expect(getInputs(stage).map((input) => input.checked)).toEqual([true, false]);
    expect(getInputs(stage)[1].disabled).toBe(false);

    // The page loads: the loader is in, no component code yet.
    play(STORY_AT.load + 0.02);
    expect(hasClass(stage, 'on-load')).toBe(true);
    expect(hasClass(stage, 'on-click')).toBe(false);
    expect(stage.dataset.step).toBe('load');

    // The click: Update, then Model, then View, then the row and the count change.
    play(STORY_AT.update - STORY_AT.load);
    expect(hasClass(stage, 'on-update')).toBe(true);
    expect(hasClass(stage, 'on-view')).toBe(false);
    expect(getInputs(stage)[1].checked).toBe(false);
    play(STORY_AT.patch - STORY_AT.update + 0.01);
    expect(hasClass(stage, 'on-view')).toBe(true);
    expect(hasClass(stage, 'on-patch')).toBe(true);
    expect(getInputs(stage)[1].checked).toBe(true);
    expect(stage.querySelector('[data-left]')?.textContent).toBe('0');
    expect(stage.querySelector('[data-hero-live]')?.textContent).toContain(
      'Loaded todo.handler.toggle.js, 119 B, _idlip-helpers.js, 928 B',
    );

    // It stops with the loop still open.
    play(1);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(hasClass(stage, 'on-fold')).toBe(false);
  });

  it.each([
    ['a mouse entering the page', 'mouse-enter'],
    ['focus on a todo', 'focus'],
    ['a press on a todo', 'press'],
  ])('waits for the click after %s and shows the cue', async (_name, kind) => {
    const stage = await load(false);
    play(0.1);
    if (kind === 'mouse-enter') {
      stage
        .querySelector('.hero-frame')
        ?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    } else if (kind === 'focus') {
      getInputs(stage)[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    } else {
      stage.querySelector('[data-target]')?.dispatchEvent(new PointerEvent('pointerdown'));
    }
    play(2);
    // It waits at the pointer's moment, before the click, with the cue on the todo.
    expect(readTime(stage)).toBeCloseTo(STORY_AT.aim, 2);
    expect(hasClass(stage, 'on-click')).toBe(false);
    expect(hasClass(stage, 'is-waiting')).toBe(true);
    expect(Number(stage.style.getPropertyValue('--pointer'))).toBe(0);
    expect(getInputs(stage)[1].checked).toBe(false);

    // The visitor's own click runs the loop.
    getInputs(stage)[1].click();
    expect(hasClass(stage, 'is-waiting')).toBe(false);
    play(0.4);
    expect(hasClass(stage, 'on-patch')).toBe(true);
    expect(getInputs(stage)[1].checked).toBe(true);
    expect(stage.querySelector('[data-hero-live]')?.textContent).toContain('Loaded');
  });

  it('keeps playing for a touch that scrolls past and for focus on the slider', async () => {
    const stage = await load(false);
    play(0.1);
    stage
      .querySelector('.hero-frame')
      ?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    getKnob(stage).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    stage.querySelector('.hero-timeline')?.dispatchEvent(new PointerEvent('pointerenter'));
    play(1);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(getInputs(stage)[1].checked).toBe(true);
  });

  it('takes no click before the loader, on the other todo before the loop, or during it', async () => {
    const stage = await load(false);
    getInputs(stage)[1].click();
    expect(getInputs(stage)[1].checked).toBe(false);
    expect(hasClass(stage, 'on-click')).toBe(false);
    play(STORY_AT.load + 0.02);
    getInputs(stage)[0].click();
    expect(getInputs(stage)[0].checked).toBe(true);
    expect(hasClass(stage, 'on-click')).toBe(false);

    // During the loop, between the click and the patch, a click changes nothing.
    play(STORY_AT.model - STORY_AT.load);
    expect(hasClass(stage, 'on-click')).toBe(true);
    expect(hasClass(stage, 'on-patch')).toBe(false);
    getInputs(stage)[0].click();
    getInputs(stage)[1].click();
    expect(getInputs(stage).map((input) => input.checked)).toEqual([true, false]);
    play(1);
    expect(getInputs(stage).map((input) => input.checked)).toEqual([true, true]);
    expect(stage.querySelector('[data-hero-live]')?.textContent).toContain('Loaded');
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

  it('moves with the arrow keys, Page Up and Down, Home and End, and says where it is', async () => {
    const stage = await load(false);
    play(0.5);
    const knob = getKnob(stage);
    expect(knob.disabled).toBe(false);
    press(stage, 'Home');
    expect(knob.getAttribute('aria-valuenow')).toBe('0');
    expect(knob.getAttribute('aria-valuetext')).toBe('The server renders the page');
    press(stage, 'ArrowRight');
    expect(knob.getAttribute('aria-valuenow')).toBe('2');
    // A key stops the story where it is.
    play(1);
    expect(knob.getAttribute('aria-valuenow')).toBe('2');
    press(stage, 'PageUp');
    expect(knob.getAttribute('aria-valuenow')).toBe('12');
    press(stage, 'PageDown');
    press(stage, 'ArrowDown');
    expect(knob.getAttribute('aria-valuenow')).toBe('0');
    press(stage, 'End');
    expect(readTime(stage)).toBe(1);
    expect(hasClass(stage, 'on-fold')).toBe(true);
    press(stage, 'ArrowLeft');
    expect(knob.getAttribute('aria-valuenow')).toBe('98');
    expect(getInputs(stage)[1].checked).toBe(true);
  });

  it('scrubs with a drag on the track and stays where it is let go', async () => {
    const stage = await load(false);
    play(0.05);
    const track = stage.querySelector<HTMLElement>('[data-scrub]');
    if (!track) {
      throw new Error('no track');
    }
    track.getBoundingClientRect = (): DOMRect => DOMRect.fromRect({ x: 100, y: 0, width: 200 });
    track.setPointerCapture = (): void => undefined;
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 160, pointerId: 1 }));
    expect(readTime(stage)).toBeCloseTo(0.3, 3);
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 240, pointerId: 1 }));
    expect(readTime(stage)).toBeCloseTo(0.7, 3);
    expect(hasClass(stage, 'on-patch')).toBe(true);
    track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, pointerId: 1 }));
    play(1);
    expect(readTime(stage)).toBeCloseTo(0.7, 3);
  });

  it('runs the loop from a click after a scrub back before the click', async () => {
    const stage = await load(false);
    play(1);
    press(stage, 'Home');
    for (let step = 0; step < 20; step++) {
      press(stage, 'ArrowRight');
    }
    expect(readTime(stage)).toBeCloseTo(0.4, 3);
    expect(getInputs(stage)[1].checked).toBe(false);
    getInputs(stage)[1].click();
    play(1);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(getInputs(stage)[1].checked).toBe(true);
  });

  it('stays at the still frame with reduced motion, says the first load, then the cache', async () => {
    const stage = await load(true);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(hasClass(stage, 'on-patch')).toBe(true);
    play(2);
    expect(readTime(stage)).toBe(STILL_AT);
    expect(getInputs(stage).map((input) => input.disabled)).toEqual([false, false]);
    const live = stage.querySelector('[data-hero-live]');
    const cached = stage.querySelector('.hero-cached');
    getInputs(stage)[1].click();
    expect(getInputs(stage)[1].checked).toBe(false);
    expect(live?.textContent).toContain('Loaded todo.handler.toggle.js');
    expect(cached?.classList.contains('is-hit')).toBe(false);
    getInputs(stage)[1].click();
    expect(getInputs(stage)[1].checked).toBe(true);
    expect(live?.textContent).toBe('Already loaded.');
    expect(cached?.classList.contains('is-hit')).toBe(true);
  });
});
