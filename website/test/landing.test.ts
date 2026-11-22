import { existsSync } from 'node:fs';
import { compile } from 'idlip/compiler';
import { describe, expect, it } from 'vitest';
import benchmarks from '../src/benchmarks.json' with { type: 'json' };
import type { DemoData, DemoFile } from '../src/demo/data.ts';
import { isBenchmarks, readGrowth } from '../src/landing/benchmarks.ts';
import type { Benchmarks } from '../src/landing/benchmarks.ts';
import { FEATURES } from '../src/landing/features.ts';
import { renderLanding } from '../src/landing/index.ts';
import { INSTALL_COMMANDS } from '../src/landing/install.ts';
import { SAMPLE_SOURCE } from '../src/landing/sample.ts';
import { EXAMPLES } from '../src/repl/examples.ts';
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
      'id="facts-title"',
      'id="final-title"',
    ];
    let last = -1;
    for (const marker of order) {
      const at = landing.indexOf(marker);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });

  it('leads with what the visitor gets: only the code they click loads', () => {
    expect(landing).toContain('<h1 class="display">Only the code you <em>click</em> loads.</h1>');
    expect(landing).not.toMatch(/<h1[^>]*>[^<]*\d/);
    expect(landing).toContain('idlip is a UI framework for server-rendered apps.');
    expect(landing).not.toContain('Your app grows');
  });

  it('keeps the scale claim and its conditions on the chart', () => {
    expect(landing).toContain('>JavaScript before the page is ready, by app size</h2>');
    expect(landing).toContain('From 10 widgets to 1,000 widgets, idlip loads 4.7 kB');
    expect(landing).toContain('loaded before the <code>load</code> event');
    expect(landing).toContain('A loader is 3.9 kB to 7.3 kB');
    expect(landing).toContain('991 B listener inline in the HTML');
    expect(landing).toContain('Qwik 1 was not run');
  });

  it('has the install tabs with a copy button in the hero and at the end', () => {
    expect(landing.match(/data-install/g)).toHaveLength(2);
    expect(landing.match(/role="tablist" aria-label="Package manager"/g)).toHaveLength(2);
    expect(landing.match(/class="install-tab" type="button" role="tab"/g)).toHaveLength(
      2 * INSTALL_COMMANDS.length,
    );
    // The pnpm tab is active and its command is plain text.
    expect(landing.match(/aria-selected="true"[^>]*data-manager="pnpm"/g)).toHaveLength(2);
    expect(landing.match(/data-copy="pnpm add idlip"/g)).toHaveLength(2);
    expect(
      landing.match(/<code class="install-command"[^>]*>pnpm add idlip<\/code>/g),
    ).toHaveLength(2);
    expect(INSTALL_COMMANDS.map((item) => item.command)).toEqual([
      'pnpm add idlip',
      'npm install idlip',
      'yarn add idlip',
      'bun add idlip',
    ]);
    const hero = landing.slice(0, landing.indexOf('id="resume-title"'));
    expect(hero).toContain('data-install');
    const final = landing.slice(landing.indexOf('id="final-title"'));
    expect(final).toContain('class="button primary"');
    expect(final).toContain('data-install');
    // Ids are unique across the two groups.
    expect(landing).toContain('id="install-hero-pnpm"');
    expect(landing).toContain('id="install-final-pnpm"');
  });

  it('has far less text than before the trim', () => {
    const main = landing.slice(landing.indexOf('<main'), landing.indexOf('</main>'));
    const text = main
      .replaceAll(/<pre[\s\S]*?<\/pre>/g, ' ')
      .replaceAll(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    // The page had 2,478 words in `<main>` outside code blocks. The goal was 40% fewer.
    expect(text.length).toBeLessThan(1486);
  });

  it('answers the main objections with facts', () => {
    const facts = landing.slice(
      landing.indexOf('id="facts-title"'),
      landing.indexOf('id="final-title"'),
    );
    for (const word of ['MIT', '0.x', 'Node 22', 'Vite 7', 'TypeScript']) {
      expect(facts, word).toContain(word);
    }
  });

  it('sets the Open Graph and Twitter tags', () => {
    for (const tag of ['og:title', 'og:description', 'og:type', 'og:image']) {
      expect(landing, tag).toContain(`property="${tag}"`);
    }
    expect(landing).toMatch(/property="og:image" content="[^"]*og\.png"/);
    expect(landing).toContain('name="twitter:card"');
    expect(existsSync(new URL('../public/og.png', import.meta.url))).toBe(true);
  });

  it('makes the share image address absolute when SITE_URL is set', () => {
    const before = process.env.SITE_URL;
    process.env.SITE_URL = 'https://idlip.example/';
    try {
      const page = renderSite(pages, '/', demo).get('index.html') ?? '';
      expect(page).toContain('property="og:image" content="https://idlip.example/og.png"');
    } finally {
      if (before === undefined) {
        delete process.env.SITE_URL;
      } else {
        process.env.SITE_URL = before;
      }
    }
  });

  it('escapes hostile strings from benchmarks.json', () => {
    const hostile = structuredClone(benchmarksData);
    hostile.machine = '"><script>alert(1)</script>';
    hostile.date = '<b>date</b>';
    for (const group of hostile.groups) {
      if (group.name === hostile.headline) {
        for (const metric of group.metrics) {
          metric.label = '<img src=x onerror=alert(1)>';
        }
      }
    }
    const page = renderLanding({ base: '/', start: 'docs/', pages, demo, benchmarks: hostile });
    expect(page).not.toContain('<img src=x');
    expect(page).not.toContain('<script>alert(1)');
    expect(page).not.toContain('<b>date</b>');
    expect(page).toContain('&lt;img src=x');
  });

  it('shows the sample in one container and sends no one to the REPL', () => {
    expect(landing.match(/class="landing-sample /g)).toHaveLength(1);
    // The sample is live: the counter and its props, with no REPL button.
    const sample = landing.slice(landing.indexOf('class="landing-sample '));
    const figure = sample.slice(0, sample.indexOf('</figure>'));
    expect(figure).toContain('<figure class="live" data-live-sample');
    expect(figure.match(/data-live-file="[^"]+"/g)).toEqual([
      'data-live-file="counter.tsx"',
      'data-live-file="props.json"',
    ]);
    expect(figure).not.toContain('data-live-repl');
    expect(landing.match(/data-live-sample /g)).toHaveLength(1);
    expect(landing).toContain('Double:');
    expect(landing.slice(landing.indexOf('<main'))).not.toContain('/repl/');
    expect(landing).not.toContain('Open in REPL');
  });

  it('labels every bar with its app, so shade is not the only key', () => {
    const growth = readGrowth(benchmarksData);
    expect(landing.match(/class="grow-app"/g)).toHaveLength(
      growth.rows.length * growth.apps.length,
    );
  });

  it('shows the diagram as a stepper and as four static steps', () => {
    expect(landing).toContain('data-resume');
    expect(landing.match(/<figure class="resume-stage" data-step="\d"/g)).toHaveLength(5);
    expect(landing).toContain('todo.handler.toggle.js');
    expect(landing).toContain('todos.*.done');
  });

  it('highlights the server HTML of the diagram and keeps the step marks', () => {
    const code = landing.slice(landing.indexOf('class="tile resume-code"'));
    const block = code.slice(0, code.indexOf('</pre>'));
    expect(block).toContain('data-lit="3"');
    expect(block).toContain('data-lit="4"');
    expect(block).toContain('tok tag_name');
  });

  it('says the hydration lane is a model and announces steps in one live element', () => {
    expect(landing).toContain('class="resume-note"');
    // One for the diagram steps and one for the hero picture.
    expect(landing.match(/aria-live="polite"/g)).toHaveLength(2);
    expect(landing.match(/data-says-live/g)).toHaveLength(1);
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

describe('the landing sample', () => {
  it('compiles with no diagnostics', () => {
    const result = compile(SAMPLE_SOURCE, '/sample.tsx');
    expect(result.diagnostics).toEqual([]);
  });

  it('is the counter of the REPL', () => {
    const counter = EXAMPLES.find((example) => example.id === 'counter');
    expect(counter?.files[0].source).toBe(SAMPLE_SOURCE);
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
