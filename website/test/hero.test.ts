import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { renderHeroStage } from '../src/landing/hero.ts';

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
  token: '',
  writes: ['todos.*.done'],
  row: '',
  state: '',
  todos: [
    { text: 'One', done: true },
    { text: 'Two <b>', done: false },
  ],
};

const stage = renderHeroStage(demo);
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('the hero picture', () => {
  it('shows the real chunk names and sizes of the demo', () => {
    expect(stage).toContain('<code>todo.handler.toggle.js</code><span>119 B</span>');
    expect(stage).toContain('<code>todo.binding.todos._.done.js</code><span>505 B</span>');
    // The loader loads with the page, so 0 B of component code next to it is no contradiction.
    expect(stage).toContain('<code>loader.js</code><span>3.9 kB, with the page</span>');
    // The two chunks of one click, summed.
    expect(stage).toContain('624 B');
    expect(stage).toContain('0 B');
  });

  it('says the picture is a model', () => {
    expect(stage).toContain('A model of the todo demo build. Nothing is fetched.');
  });

  it('draws the end state without the script, for the still frame', () => {
    // No inline `--clicked`, so the stylesheet default (1) holds. The clicked row is done.
    expect(stage).not.toContain('--clicked');
    expect(stage).toContain('data-flip style="--done:1;--rest:0"');
    expect(stage).toContain('<b data-left>0</b> left');
    // The boxes are disabled until the script enables them.
    expect(stage.match(/disabled/g)).toHaveLength(2);
  });

  it('hides the cached mark from screen readers and has one polite live line', () => {
    expect(stage.match(/<i class="hero-hit" aria-hidden="true">cached<\/i>/g)).toHaveLength(2);
    expect(stage.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(stage).toContain(
      'data-first="Loaded todo.handler.toggle.js and todo.binding.todos._.done.js, 624 B."',
    );
    expect(stage).toContain('data-later="Already loaded."');
  });

  it('escapes the todo text', () => {
    expect(stage).toContain('Two &lt;b&gt;');
    expect(stage).not.toContain('Two <b>');
  });

  it('draws the rest state only with scripts and allowed motion, and settles by itself', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.js \.hero-stage:not\(\[data-live\]\) \{\s*--clicked: 0;\s*animation: hero-settle/,
    );
    expect(css).toContain('@keyframes hero-settle');
    expect(css).toMatch(/\.hero-stage \{\s*--clicked: 1;/);
  });
});

type Listener = (event: unknown) => void;

class FakeInput {
  checked: boolean;
  disabled = true;
  row: FakeRow | undefined;

  constructor(checked: boolean) {
    this.checked = checked;
  }

  closest(): FakeRow | undefined {
    return this.row;
  }
}

class FakeRow {
  props: Record<string, string>;
  input: FakeInput;
  style = {
    setProperty: (name: string, value: string): void => {
      this.props[name] = value;
    },
    getPropertyValue: (name: string): string => this.props[name] ?? '',
  };

  constructor(input: FakeInput, props: Record<string, string>) {
    this.input = input;
    this.props = props;
    input.row = this;
  }

  querySelector(): FakeInput {
    return this.input;
  }
}

interface FakeHit {
  marks: Set<string>;
  classList: { add: (name: string) => void; remove: (name: string) => void };
}

function makeHit(): FakeHit {
  const marks = new Set<string>();
  return {
    marks,
    classList: {
      add: (name) => {
        marks.add(name);
      },
      remove: (name) => {
        marks.delete(name);
      },
    },
  };
}

interface Fake {
  props: Record<string, string>;
  dataset: Record<string, string>;
  live: { textContent: string; dataset: Record<string, string> };
  count: { textContent: string };
  flip: FakeInput;
  other: FakeInput;
  hits: FakeHit[];
  fire: (type: string, event?: unknown) => void;
  watch: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
}

/** Loads `hero.ts` against a fake page whose motion preference is `reduced`. */
async function load(reduced: boolean): Promise<Fake> {
  const props: Record<string, string> = {};
  const listeners: Record<string, Listener[]> = {};
  const flip = new FakeInput(true);
  const other = new FakeInput(true);
  const flipRow = new FakeRow(flip, { '--rest': '0', '--done': '1' });
  const hits = [makeHit(), makeHit()];
  const live = {
    textContent: '',
    dataset: { first: 'Loaded both.', later: 'Already loaded.' },
  };
  const count = { textContent: '0' };
  const fake: Fake = {
    props,
    dataset: {},
    live,
    count,
    flip,
    other,
    hits,
    fire: (type, event) => {
      for (const listener of listeners[type] ?? []) {
        listener(event);
      }
    },
    watch: undefined,
  };
  const page = {
    dataset: fake.dataset,
    style: {
      setProperty: (name: string, value: string): void => {
        props[name] = value;
      },
    },
    addEventListener: (type: string, listener: Listener): void => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    },
    querySelectorAll: (selector: string): unknown[] =>
      selector.startsWith('input') ? [flip, other] : hits,
    querySelector: (selector: string): unknown => {
      if (selector === '[data-left]') {
        return count;
      }
      if (selector === '[data-hero-live]') {
        return live;
      }
      return selector === '[data-flip] input' ? flip : flipRow;
    },
  };
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('window', { IntersectionObserver: true });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        fake.watch = callback;
      }

      observe = vi.fn();
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('document', { querySelector: () => page });
  vi.resetModules();
  await import('../src/client/hero.ts');
  return fake;
}

describe('the hero script', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts the picture at rest, then clicks by itself after the delay', async () => {
    vi.useFakeTimers();
    const fake = await load(false);
    expect(fake.dataset.live).toBe('');
    expect(fake.props['--clicked']).toBe('0');
    expect(fake.flip.checked).toBe(false);
    vi.advanceTimersByTime(1599);
    expect(fake.props['--clicked']).toBe('0');
    vi.advanceTimersByTime(1);
    expect(fake.props['--clicked']).toBe('1');
    expect(fake.flip.checked).toBe(true);
    expect(fake.count.textContent).toBe('0');
    expect(fake.live.textContent).toBe('Loaded both.');
  });

  it.each(['focusin', 'pointerenter', 'pointerdown'])(
    'never clicks by itself after %s',
    async (type) => {
      vi.useFakeTimers();
      const fake = await load(false);
      fake.fire(type);
      vi.advanceTimersByTime(10_000);
      expect(fake.props['--clicked']).toBe('0');
      expect(fake.flip.checked).toBe(false);
      // The visitor's own click still loads the chunks.
      fake.other.checked = false;
      fake.fire('change', { target: fake.other });
      expect(fake.props['--clicked']).toBe('1');
      expect(fake.live.textContent).toBe('Loaded both.');
    },
  );

  it('loads on the first click and serves later clicks from the cache', async () => {
    vi.useFakeTimers();
    const fake = await load(false);
    fake.other.checked = false;
    fake.fire('change', { target: fake.other });
    expect(fake.props['--clicked']).toBe('1');
    expect(fake.live.textContent).toBe('Loaded both.');
    expect(fake.count.textContent).toBe('2');
    // The timer is gone, so the picture does not click again.
    vi.advanceTimersByTime(5000);
    expect(fake.flip.checked).toBe(false);
    expect(fake.hits[0].marks.has('is-hit')).toBe(false);
    fake.other.checked = true;
    fake.fire('change', { target: fake.other });
    expect(fake.live.textContent).toBe('Already loaded.');
    expect(fake.hits[0].marks.has('is-hit')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(fake.hits[0].marks.has('is-hit')).toBe(false);
  });

  it('pauses while off screen and waits again when back on screen', async () => {
    vi.useFakeTimers();
    const fake = await load(false);
    fake.watch?.([{ isIntersecting: false }]);
    vi.advanceTimersByTime(10_000);
    expect(fake.props['--clicked']).toBe('0');
    fake.watch?.([{ isIntersecting: true }]);
    vi.advanceTimersByTime(1600);
    expect(fake.props['--clicked']).toBe('1');
  });

  it('leaves the end state with reduced motion, and a click shows the cache', async () => {
    vi.useFakeTimers();
    const fake = await load(true);
    expect(fake.dataset.live).toBeUndefined();
    expect(fake.props['--clicked']).toBeUndefined();
    expect(fake.flip.disabled).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(fake.flip.checked).toBe(true);
    fake.other.checked = false;
    fake.fire('change', { target: fake.other });
    expect(fake.live.textContent).toBe('Already loaded.');
    expect(fake.hits[0].marks.has('is-hit')).toBe(true);
  });
});
