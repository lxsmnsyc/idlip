import { describe, expect, it } from 'vitest';
import benchmarks from '../src/benchmarks.json' with { type: 'json' };
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { isBenchmarks, readGrowth } from '../src/landing/benchmarks.ts';
import type { Benchmarks } from '../src/landing/benchmarks.ts';
import { FEATURES } from '../src/landing/features.ts';
import { loadPages, renderSite } from '../src/site.ts';

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
  chunks: [
    makeFile('todo.handler.toggle.js', 119),
    makeFile('todo.binding.todos._.done.js', 505),
    makeFile('todo.list.3.js', 450),
  ],
  handlerName: 'toggle',
  token: '["toggle",["a2"]]',
  writes: ['todos.*.done'],
  row: '<li i-a="4"><input type="checkbox" on:click=\'["toggle",["a2"]]\' i-a="5 7"><!--t6-->Two<!--/t--></li>',
  state:
    '<script i-state>(self.$idlip||=[]).push(["click",()=>({manifest:{},model:{todos:[]},props:{}})])</script>',
  todos: [
    { text: 'One', done: true },
    { text: 'Two', done: false },
  ],
};

const pages = loadPages();
if (!isBenchmarks(benchmarks)) {
  throw new TypeError('benchmarks.json has the wrong shape');
}
const benchmarksData: Benchmarks = benchmarks;
const landing = renderSite(pages, '/', demo).get('index.html') ?? '';

describe('the landing page', () => {
  it('has each section in order', () => {
    const order = [
      'class="tile tile-ink hero"',
      'id="resume-title"',
      'id="features-title"',
      'id="benchmarks"',
      'id="sample-title"',
    ];
    let last = -1;
    for (const marker of order) {
      const at = landing.indexOf(marker);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });

  it('shows the diagram as a stepper and as four static steps', () => {
    expect(landing).toContain('data-resume');
    expect(landing.match(/<figure class="resume-stage" data-step="\d"/g)).toHaveLength(5);
    expect(landing).toContain('todo.handler.toggle.js');
    expect(landing).toContain('todos.*.done');
  });

  it('says the hydration lane is a model and announces steps in one live element', () => {
    expect(landing).toContain('class="resume-note"');
    expect(landing.match(/aria-live="polite"/g)).toHaveLength(1);
  });

  it('charts the headline group: one row per framework run on every app', () => {
    const growth = readGrowth(benchmarksData);
    expect(growth.apps.length).toBeGreaterThanOrEqual(2);
    expect(landing.match(/class="grow-row/g)).toHaveLength(growth.rows.length);
    expect(landing.match(/class="grow-bar /g)).toHaveLength(
      growth.rows.length * growth.apps.length,
    );
    expect(landing).toContain('class="grow-row is-own"');
    expect(landing).toContain('All results and how they were measured');
    expect(landing).not.toContain('demo-frame');
  });

  it('links every feature card to an existing page', () => {
    const urls = new Set<string>();
    for (const page of pages) {
      urls.add(`/${page.url}`);
    }
    const links = [...landing.matchAll(/<li class="feature"><a href="([^"]+)"/g)];
    expect(links).toHaveLength(FEATURES.length);
    for (const [, href] of links) {
      expect(urls.has(href), href).toBe(true);
    }
  });
});

describe('the benchmark data', () => {
  if (!isBenchmarks(benchmarks)) {
    throw new TypeError('benchmarks.json has the wrong shape');
  }
  const data: Benchmarks = benchmarks;

  it('has the run date, the machine and the source', () => {
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.machine).not.toBe('');
    expect(data.source).toBe('benchmarks/README.md');
    expect(data.frameworks[0]).toBe('idlip');
  });

  it('gives every metric the fields the table reads', () => {
    for (const group of data.groups) {
      expect(group.name).not.toBe('');
      for (const metric of group.metrics) {
        expect(metric.name).not.toBe('');
        expect(['kB', 'B', 'MB', 'ms', '/s']).toContain(metric.unit);
        expect(['lower', 'higher']).toContain(metric.better);
        expect(typeof metric.noise).toBe('number');
        expect(Object.keys(metric.values).toSorted()).toEqual(data.frameworks.toSorted());
        expect(typeof metric.values.idlip).toBe('number');
      }
    }
  });

  it('labels each app of the headline group', () => {
    for (const group of data.groups) {
      if (group.name === data.headline) {
        for (const metric of group.metrics) {
          expect(metric.label, metric.name).toBeTruthy();
        }
      }
    }
  });
});
