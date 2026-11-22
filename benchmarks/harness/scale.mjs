// The scale scenario: one page per app size, with N distinct widget components.
//
//   node harness/scale.mjs write <framework>   writes the widgets of one framework into
//                                              <framework>/scale/src. N comes from BENCH_SCALE.
//   node harness/scale.mjs run [options]       builds every framework at every size, serves the
//                                              page and measures it. Run with --help for options.
//
// The widgets come from the dashboard generator, so a widget has the same code in every size and
// every framework. The pages have no preload switch: each framework loads what it loads.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { findChrome, MISSING_CHROME } from './chrome.mjs';
import { CLICKS, expected, widgets, write } from './dashboard.mjs';
import { appDir, benchDir } from './frameworks.mjs';

export const SIZES = [10, 50, 200, 1000];
const START_TIMEOUT_MS = 60000;
export const FRAMEWORKS = ['idlip', 'brumate', 'marko', 'qwik2'];

function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadAverage() {
  const load = [];
  for (const value of os.loadavg()) {
    load.push(Math.round(value * 100) / 100);
  }
  return load;
}

function log(message) {
  console.error(`[scale] ${message}`);
}

function isScript(entry) {
  return entry.type === 'script' || /\.m?js(\?|$)/.test(entry.url);
}

// --- Build and serve -----------------------------------------------------------

export function buildApp(framework, count) {
  return new Promise((resolve) => {
    // Under `node --test` the variable would make the build's own node processes act as test
    // children, and the build would hang.
    const env = { ...process.env, BENCH_SCALE: String(count) };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn('pnpm', ['run', 'build:scale'], {
      cwd: appDir(framework),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('error', (error) => resolve({ ok: false, output: String(error) }));
    child.on('exit', (code) => resolve({ ok: code === 0, output: out.trim().slice(-1500) }));
  });
}

export function startServer(framework) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(benchDir, 'harness/serve.mjs'), framework, 'scale'],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`server for ${framework} did not start in ${START_TIMEOUT_MS / 1000} s`));
    }, START_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const match = /ready (\d+)/.exec(out);
      if (match) {
        clearTimeout(timer);
        resolve({ child, base: `http://127.0.0.1:${match[1]}` });
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server for ${framework} exited with ${code}`));
    });
  });
}

// --- Measure -------------------------------------------------------------------

// Bytes before the first click, then the first click. Not throttled. A phase is `boot` until the
// load event, then `idle` for the idle wait, then `click`.
async function measureBytes(browser, base, count, idleMs) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const log = [];
  const pending = [];
  const phaseOf = new Map();
  let phase = 'boot';
  page.on('request', (request) => phaseOf.set(request, phase));
  page.on('response', (response) => {
    const url = response.url();
    if (!url.startsWith(base) || url === `${base}/`) {
      return;
    }
    pending.push(
      response.body().then(
        (body) =>
          log.push({
            phase: phaseOf.get(response.request()),
            url,
            type: response.request().resourceType(),
            raw: body.length,
            gzip: gzipSync(body, { level: 9 }).length,
          }),
        () => {},
      ),
    );
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  const html = Buffer.from(await (await fetch(`${base}/`)).arrayBuffer());
  await page.goto(`${base}/`, { waitUntil: 'load' });
  phase = 'idle';
  await page.waitForLoadState('networkidle');
  await sleep(idleMs);

  // The first click: the "run" button of one widget, done when it shows what Node computes.
  phase = 'click';
  const widget = widgets(Math.max(count, CLICKS.above + 1))[CLICKS.above];
  const want = expected(widget, 'run');
  let clicked = true;
  try {
    await page.locator(`#${widget.id} .run`).click({ timeout: 10000 });
    await page.waitForFunction(
      ({ id, output }) => document.querySelector(`#${id} .out`)?.textContent === output,
      { id: widget.id, output: want.output },
      { timeout: 10000 },
    );
  } catch {
    clicked = false;
  }
  await sleep(500);
  await Promise.all(pending);
  const domWidgets = await page.locator('.widget').count();
  await context.close();

  // Scripts, and everything else that a phase fetched besides the document (JSON, styles,
  // fonts, images and other fetches), so a total leaves nothing out.
  const sums = { boot: [0, 0], idle: [0, 0], click: [0, 0] };
  const files = { boot: 0, idle: 0, click: 0 };
  const other = { boot: [0, 0], idle: [0, 0], click: [0, 0] };
  for (const entry of log) {
    if (!sums[entry.phase]) {
      continue;
    }
    const bucket = isScript(entry) ? sums : other;
    bucket[entry.phase][0] += entry.raw;
    bucket[entry.phase][1] += entry.gzip;
    if (bucket === sums) {
      files[entry.phase]++;
    }
  }
  const htmlGzip = gzipSync(html, { level: 9 }).length;
  const beforeClick = {
    jsRaw: sums.boot[0] + sums.idle[0],
    jsGzip: sums.boot[1] + sums.idle[1],
    jsFiles: files.boot + files.idle,
  };
  return {
    htmlRaw: html.length,
    htmlGzip,
    bootJsRaw: sums.boot[0],
    bootJsGzip: sums.boot[1],
    jsRaw: beforeClick.jsRaw,
    jsGzip: beforeClick.jsGzip,
    jsFiles: beforeClick.jsFiles,
    otherBootGzip: other.boot[1],
    otherGzip: other.boot[1] + other.idle[1],
    allBootGzip: htmlGzip + sums.boot[1] + other.boot[1],
    allGzip: htmlGzip + beforeClick.jsGzip + other.boot[1] + other.idle[1],
    clickJsGzip: sums.click[1],
    clickJsFiles: files.click,
    clickOtherGzip: other.click[1],
    clicked,
    domWidgets,
    htmlWidgets: (html.toString().match(/class="?widget"?[\s>]/g) ?? []).length,
    errors,
  };
}

/**
 * What is wrong with a measured page: the click did not show the result that Node computes, not
 * every widget is in the DOM or the HTML, or the page threw. An empty list means it is good.
 */
export function checkPage(bytes, count) {
  const problems = [];
  if (!bytes.clicked) {
    problems.push('the first click did not show the expected result');
  }
  if (bytes.domWidgets !== count) {
    problems.push(`${bytes.domWidgets} widgets in the DOM, expected ${count}`);
  }
  if (bytes.htmlWidgets !== count) {
    problems.push(`${bytes.htmlWidgets} widgets in the HTML, expected ${count}`);
  }
  for (const error of bytes.errors) {
    problems.push(`page error: ${error}`);
  }
  return problems;
}

// One throttled load. Returns the main-thread script and task time, in ms, from navigation to
// the load event.
async function timeLoad(browser, base, cpu) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const { metrics } = await cdp.send('Performance.getMetrics');
  await context.close();
  const seconds = {};
  for (const metric of metrics) {
    seconds[metric.name] = metric.value;
  }
  return {
    script: (seconds.ScriptDuration ?? 0) * 1000,
    task: (seconds.TaskDuration ?? 0) * 1000,
  };
}

async function runSize(browser, framework, count, options) {
  const { child, base } = await startServer(framework);
  try {
    log(`${framework} ${count}: bytes`);
    const bytes = await measureBytes(browser, base, count, options.idleMs);
    return { child, base, bytes };
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function runSizes(browser, size, options) {
  const out = {};
  const servers = {};
  for (const framework of options.frameworks) {
    log(`${framework} ${size}: build`);
    const built = await buildApp(framework, size);
    if (!built.ok) {
      out[framework] = { error: built.output };
      continue;
    }
    try {
      const { child, base, bytes } = await runSize(browser, framework, size, options);
      const problems = checkPage(bytes, size);
      if (problems.length > 0) {
        child.kill();
        out[framework] = { bytes, error: `page check failed: ${problems.join('; ')}` };
        continue;
      }
      servers[framework] = { child, base };
      out[framework] = { bytes, script: [], task: [] };
    } catch (error) {
      out[framework] = { error: String(error) };
    }
  }
  try {
    if (!options.bytesOnly) {
      // The runs rotate the framework order, so none always goes first.
      const names = Object.keys(servers);
      for (let round = 0; round < options.runs + 1; round++) {
        for (let i = 0; i < names.length; i++) {
          const name = names[(i + round) % names.length];
          const sample = await timeLoad(browser, servers[name].base, options.cpu);
          // The first round warms the disk cache and the JIT. It is not kept.
          if (round > 0) {
            out[name].script.push(sample.script);
            out[name].task.push(sample.task);
          }
        }
      }
      for (const name of names) {
        out[name].scriptMedian = median(out[name].script);
        out[name].taskMedian = median(out[name].task);
      }
    }
  } finally {
    for (const { child } of Object.values(servers)) {
      child.kill();
    }
  }
  return out;
}

// --- Report --------------------------------------------------------------------

function kb(bytes) {
  return (bytes / 1000).toFixed(1);
}

export function report(result) {
  const lines = [
    `Machine: ${result.machine.cpu}, load average ${result.machine.loadAvg.join(' ')} at the start`,
  ];
  for (const size of result.sizes) {
    const { loadAvgBefore, loadAvgAfter } = result.data[size];
    lines.push(
      `Load average at ${size} widgets: ${loadAvgBefore.join(' ')} before, ${loadAvgAfter.join(' ')} after`,
    );
  }
  const metrics = [
    ['JS before `load`, gzip (kB)', (e) => kb(e.bytes.bootJsGzip)],
    ['JS before the first click, gzip (kB)', (e) => kb(e.bytes.jsGzip)],
    ['JS before the first click, raw (kB)', (e) => kb(e.bytes.jsRaw)],
    ['HTML, gzip (kB)', (e) => kb(e.bytes.htmlGzip)],
    ['HTML, raw (kB)', (e) => kb(e.bytes.htmlRaw)],
    ['All bytes before `load` (HTML, JS and the rest), gzip (kB)', (e) => kb(e.bytes.allBootGzip)],
    ['All bytes before the first click, gzip (kB)', (e) => kb(e.bytes.allGzip)],
    ['Non-JS fetches before the first click, gzip (kB)', (e) => kb(e.bytes.otherGzip)],
    ['JS fetched by the first click, gzip (kB)', (e) => kb(e.bytes.clickJsGzip)],
    ['Script time to load, 4x CPU (ms)', (e) => e.scriptMedian?.toFixed(0) ?? 'n/a'],
    ['Main-thread task time to load, 4x CPU (ms)', (e) => e.taskMedian?.toFixed(0) ?? 'n/a'],
  ];
  for (const [title, read] of metrics) {
    lines.push('', `${title}`, '');
    lines.push(`| Framework | ${result.sizes.join(' | ')} |`);
    lines.push(`| --- |${' ---: |'.repeat(result.sizes.length)}`);
    for (const framework of result.frameworks) {
      const cells = [];
      for (const size of result.sizes) {
        const entry = result.data[size][framework];
        cells.push(!entry || entry.error ? 'failed' : read(entry));
      }
      lines.push(`| ${framework} | ${cells.join(' | ')} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// --- Main ----------------------------------------------------------------------

async function main(args) {
  const { values: flags } = parseArgs({
    options: {
      sizes: { type: 'string', default: SIZES.join(',') },
      only: { type: 'string', default: FRAMEWORKS.join(',') },
      runs: { type: 'string', default: '10' },
      cpu: { type: 'string', default: '4' },
      idle: { type: 'string', default: '3000' },
      'bytes-only': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    args,
  });
  if (flags.help) {
    console.log(
      'Usage: node harness/scale.mjs run [--sizes 10,50,200,1000] [--only idlip,brumate,marko,qwik2]\n' +
        '  [--runs 10] [--cpu 4] [--idle 3000] [--bytes-only]',
    );
    return;
  }
  const launch = findChrome();
  if (!launch) {
    console.error(MISSING_CHROME);
    process.exit(1);
  }
  const { chromium } = await import('playwright-core');
  const sizes = [];
  for (const size of flags.sizes.split(',')) {
    sizes.push(Number(size));
  }
  const options = {
    frameworks: flags.only.split(','),
    runs: Number(flags.runs),
    cpu: Number(flags.cpu),
    idleMs: Number(flags.idle),
    bytesOnly: flags['bytes-only'],
  };
  const browser = await chromium.launch({ ...launch, headless: true });
  const cpus = os.cpus();
  const result = {
    date: new Date().toISOString(),
    machine: {
      cpu: cpus[0]?.model ?? 'unknown',
      cores: cpus.length,
      node: process.version,
      chrome: browser.version(),
      loadAvg: loadAverage(),
    },
    options,
    sizes,
    frameworks: options.frameworks,
    data: {},
  };
  try {
    for (const size of sizes) {
      const loadAvgBefore = loadAverage();
      result.data[size] = await runSizes(browser, size, options);
      result.data[size].loadAvgBefore = loadAvgBefore;
      result.data[size].loadAvgAfter = loadAverage();
    }
  } finally {
    await browser.close();
  }
  result.machine.loadAvgEnd = loadAverage();
  const stamp = result.date.replace(/[:.]/g, '-');
  await mkdir(path.join(benchDir, 'results'), { recursive: true });
  await writeFile(
    path.join(benchDir, 'results', `scale-${stamp}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(report(result));
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'write') {
    await write(rest[0], 'scale', Number(process.env.BENCH_SCALE ?? 10));
  } else if (command === 'run') {
    await main(rest);
  } else {
    console.error('Usage: node harness/scale.mjs write <framework> | run [options]');
    process.exit(1);
  }
}
