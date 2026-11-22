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
    expect(stage).toContain('<code>loader.js</code><span>3.9 kB</span>');
    // The two chunks of one click, summed.
    expect(stage).toContain('624 B');
    expect(stage).toContain('0 B');
  });

  it('draws the end state without the script, for the still frame', () => {
    // No inline `--clicked`, so the stylesheet default (1) holds. The clicked row is done.
    expect(stage).not.toContain('--clicked');
    expect(stage).toContain('data-flip style="--done:1;--rest:0"');
    expect(stage).toContain('<b data-left>0</b> left');
    // The boxes are disabled until the script enables them.
    expect(stage.match(/disabled/g)).toHaveLength(2);
  });

  it('escapes the todo text', () => {
    expect(stage).toContain('Two &lt;b&gt;');
    expect(stage).not.toContain('Two <b>');
  });

  it('moves to the rest state only when scripts run and motion is allowed', () => {
    const rule = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .js .hero-stage'),
    );
    expect(rule.slice(0, rule.indexOf('\n}\n'))).toContain('.js .hero-stage:not([data-live])');
    expect(css).toContain('.hero-stage {\n  --clicked: 1;');
  });
});

interface FakeStage {
  dataset: Record<string, string>;
  props: Record<string, string>;
  style: { setProperty: (name: string, value: string) => void };
  querySelectorAll: () => unknown[];
  querySelector: () => null;
  addEventListener: () => void;
}

function makeStage(): FakeStage {
  const props: Record<string, string> = {};
  return {
    dataset: {},
    props,
    style: {
      setProperty: (name, value) => {
        props[name] = value;
      },
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => undefined,
  };
}

/** Loads `hero.ts` against a fake page whose motion preference is `reduced`. */
async function load(reduced: boolean): Promise<FakeStage> {
  const fake = makeStage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('document', { querySelector: () => fake });
  vi.resetModules();
  await import('../src/client/hero.ts');
  return fake;
}

describe('the hero script', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts the picture at rest when motion is allowed', async () => {
    const fake = await load(false);
    expect(fake.dataset.live).toBe('');
    expect(fake.props['--clicked']).toBe('0');
  });

  it('leaves the end state as it is with reduced motion', async () => {
    const fake = await load(true);
    expect(fake.dataset.live).toBeUndefined();
    expect(fake.props['--clicked']).toBeUndefined();
  });
});
