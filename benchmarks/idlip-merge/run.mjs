// Spike `spike-chunk-merge`: the cold first click of the idlip bench app in three variants.
//
//   split     The current build: one chunk per handler and per binding group.
//   merged    All chunks of the module in one file, as brumate's `merge` option does.
//   parallel  The current split, but the click starts the handler chunk and the binding chunks of
//             its write set at once, as the `write-sets` node will make the loader do.
//
// The app is `benchmarks/idlip` built with the config below into `idlip-merge/dist`. No package
// changes: the merged file and the parallel starts are made after the build and in the HTML.
//
//   node benchmarks/idlip-merge/run.mjs [--rounds 15] [--latency 150] [--no-build]
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { findChrome } from '../harness/chrome.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '../idlip');
const distDir = path.join(here, 'dist');
const clientDir = path.join(distDir, 'client');
const assetsDir = path.join(clientDir, 'assets');
const fromApp = createRequire(path.join(appDir, 'package.json'));
const fromHarness = createRequire(path.join(here, '../harness/package.json'));

const { values: flags } = parseArgs({
  options: {
    rounds: { type: 'string', default: '15' },
    latency: { type: 'string', default: '150' },
    idle: { type: 'string', default: '1000' },
    'no-build': { type: 'boolean', default: false },
    gzip: { type: 'boolean', default: false },
  },
});
const ROUNDS = Number(flags.rounds);
const LATENCY = Number(flags.latency);
const IDLE = Number(flags.idle);
// Serve JS with gzip -9, as a real server would. Off by default, as in the harness.
const GZIP = flags.gzip;

// The write set of each handler: the binding groups whose paths it writes. `write-sets` will
// compute this in the compiler; here it is written by hand from `src/app.tsx`.
const WRITES = {
  increment: ['count'],
  toggle: ['todos.*.done'],
  add: ['todos', 'draft'],
  setDraft: ['draft'],
};

async function importFrom(require, specifier) {
  return import(pathToFileURL(require.resolve(specifier)).href);
}

// Builds the bench app with a local config: the same options as `benchmarks/idlip`, written to
// this folder's `dist`.
async function buildApp() {
  const vite = await importFrom(fromApp, 'vite');
  const { idlip } = await import(pathToFileURL(fromApp.resolve('idlip/vite')).href);
  const builder = await vite.createBuilder({
    root: appDir,
    configFile: false,
    logLevel: 'warn',
    plugins: [idlip({ entry: '/src/entry-server.ts' })],
    build: { outDir: distDir, emptyOutDir: true },
    environments: {
      client: {
        build: {
          manifest: true,
          rolldownOptions: {
            input: { loader: 'idlip/client' },
            output: {
              entryFileNames: 'assets/[name].[hash].js',
              chunkFileNames: 'assets/[name].[hash].js',
            },
          },
        },
      },
    },
  });
  await builder.buildApp();
}

// Bundles every chunk of the module into one file. An export name that several chunks share
// (a list's `l` binding, covered bindings) comes from the first chunk, as the loader keeps the
// first binding of a name.
async function buildMerged(chunkFiles) {
  const vite = await importFrom(fromApp, 'vite');
  const taken = new Set();
  const lines = [];
  for (const file of chunkFiles) {
    const module = await import(pathToFileURL(path.join(assetsDir, file)).href);
    const names = [];
    for (const name of Object.keys(module)) {
      if (!taken.has(name)) {
        taken.add(name);
        names.push(name);
      }
    }
    lines.push(
      `export { ${names.join(', ')} } from ${JSON.stringify(path.join(assetsDir, file))};`,
    );
  }
  const entry = path.join(distDir, 'merged-entry.js');
  await writeFile(entry, `${lines.join('\n')}\n`);
  const output = await vite.build({
    root: distDir,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: assetsDir,
      emptyOutDir: false,
      copyPublicDir: false,
      modulePreload: false,
      rolldownOptions: {
        input: { 'app.merged': entry },
        preserveEntrySignatures: 'strict',
        output: { entryFileNames: '[name].[hash].js' },
      },
    },
  });
  const outputs = Array.isArray(output) ? output : [output];
  for (const out of outputs) {
    for (const chunk of out.output) {
      if (chunk.type === 'chunk' && chunk.isEntry) {
        return chunk.fileName;
      }
    }
  }
  throw new Error('The merged build has no entry.');
}

function measureFile(body) {
  return { raw: body.length, gzip: gzipSync(body, { level: 9 }).length };
}

// Reads the chunk map of the rendered HTML: virtual chunk id to built URL.
function readChunks(html) {
  const chunks = {};
  for (const match of html.matchAll(
    /"(\/src\/[^"]+\?idlip-([a-z]+)=([^&"]+)&lang\.js)":"([^"]+)"/g,
  )) {
    chunks[`${match[2]}=${match[3]}`] = match[4];
  }
  return chunks;
}

// The script of the parallel variant: on a click, before the loader sees it, start the handler
// chunk and the chunks of its write set. The loader's own `import()` of the same URL then joins
// the request in flight.
function createParallelScript(chunks) {
  const starts = {};
  for (const [handler, groups] of Object.entries(WRITES)) {
    const urls = [chunks[`handler=${handler}`]];
    for (const group of groups) {
      urls.push(chunks[`binding=${group}`]);
    }
    starts[handler] = urls;
  }
  return (
    `<script>((s)=>{for(const t of['click','input','submit'])document.addEventListener(t,(e)=>{` +
    `const x=e.target.closest?.('[on\\\\:'+t+']');if(!x)return;` +
    `const u=s[JSON.parse(x.getAttribute('on:'+t))[0]];if(u)for(const v of u)import(v)},true)})` +
    `(${JSON.stringify(starts)})</script>`
  );
}

async function loadVariants() {
  const server = await import(pathToFileURL(path.join(distDir, 'server/entry-server.js')).href);
  const manifest = JSON.parse(await readFile(path.join(clientDir, '.vite/manifest.json'), 'utf8'));
  let loader;
  for (const item of Object.values(manifest)) {
    if (item.name === 'loader' && item.isEntry) {
      loader = `/${item.file}`;
    }
  }
  const files = await readdir(assetsDir);
  const chunkFiles = [];
  for (const file of files.toSorted()) {
    if (file.startsWith('app.') && !file.startsWith('app.merged.')) {
      chunkFiles.push(file);
    }
  }
  const mergedFile = await buildMerged(chunkFiles);
  const sample = await server.page(3, loader);
  const chunks = readChunks(sample);
  const parallelScript = createParallelScript(chunks);

  const sizes = { split: { files: chunkFiles.length, raw: 0, gzip: 0 } };
  for (const file of chunkFiles) {
    const size = measureFile(await readFile(path.join(assetsDir, file)));
    sizes.split.raw += size.raw;
    sizes.split.gzip += size.gzip;
  }
  sizes.merged = { files: 1, ...measureFile(await readFile(path.join(assetsDir, mergedFile))) };
  sizes.parallelScript = measureFile(Buffer.from(parallelScript));

  return {
    sizes,
    chunks,
    mergedFile,
    variants: {
      split: (n) => server.page(n, loader),
      merged: async (n) => {
        // Every chunk id of the module points at the merged file.
        const html = await server.page(n, loader);
        return html.replaceAll(/"\/assets\/app\.[^"]+\.js"/g, `"/assets/${mergedFile}"`);
      },
      parallel: async (n) => {
        const html = await server.page(n, loader);
        return html.replace('<script type="module"', `${parallelScript}<script type="module"`);
      },
    },
  };
}

function startServer(variants) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    response.setHeader('cache-control', 'no-store');
    try {
      if (url.pathname === '/') {
        const variant = variants[url.searchParams.get('v')];
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(await variant(Number(url.searchParams.get('n') ?? 3)));
        return;
      }
      const file = path.join(clientDir, path.normalize(decodeURIComponent(url.pathname)));
      if (!file.startsWith(clientDir + path.sep)) {
        response.statusCode = 403;
        response.end();
        return;
      }
      const body = await readFile(file);
      response.setHeader('content-type', 'text/javascript');
      if (GZIP) {
        response.setHeader('content-encoding', 'gzip');
        response.end(gzipSync(body, { level: 9 }));
        return;
      }
      response.end(body);
    } catch (error) {
      response.statusCode = error?.code === 'ENOENT' ? 404 : 500;
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const STEPS = {
  counter: {
    run: (page) => page.locator('h2 + button').click(),
    done: () =>
      document.querySelector('h2 + button').textContent.includes('Clicked 1 times') &&
      document.body.textContent.includes('Double: 2'),
  },
  toggle: {
    run: (page) => page.locator('ul li button').nth(1).click(),
    done: () =>
      document.querySelector('ul + p').textContent === '1 left' &&
      document.querySelectorAll('ul li')[1].className.includes('done'),
  },
};

function debug(text) {
  if (process.env.VERBOSE) {
    process.stdout.write(`      ${text}\n`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The longest chain of requests in which each starts after the previous one finished. Same rule
// as `harness/browser.mjs`.
function countRoundTrips(requests) {
  const sorted = requests.toSorted((a, b) => a.start - b.start);
  let max = 0;
  for (const request of sorted) {
    let depth = 0;
    for (const other of sorted) {
      if (other !== request && other.end !== undefined && other.end <= request.start) {
        depth = Math.max(depth, other.depth ?? 1);
      }
    }
    request.depth = 1 + depth;
    max = Math.max(max, request.depth);
  }
  return max;
}

// One click on a throttled network. Cold: slow from the start, click right at `load`. Idle: the
// page loads and idles, then the network slows down before the click.
async function measureClick(browser, base, { variant, step, cold }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const cdp = await context.newCDPSession(page);
  function throttle() {
    return cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: LATENCY,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  if (cold) {
    await throttle();
  }
  await page.goto(`${base}/?v=${variant}&n=3`, { waitUntil: 'load' });
  if (!cold) {
    await page.waitForLoadState('networkidle');
    await sleep(IDLE);
    await throttle();
  }
  const requests = new Map();
  const bodies = [];
  let start = 0;
  page.on('request', (request) =>
    requests.set(request, {
      url: request.url().slice(base.length),
      start: performance.now() - start,
    }),
  );
  function finish(request) {
    const entry = requests.get(request);
    if (entry) {
      entry.end = performance.now() - start;
    }
  }
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  page.on('response', (response) => {
    bodies.push(
      response.body().then(
        (body) => {
          const entry = requests.get(response.request());
          if (entry) {
            Object.assign(entry, measureFile(body));
          }
        },
        () => {},
      ),
    );
  });
  start = performance.now();
  debug('click');
  await STEPS[step].run(page);
  debug('clicked');
  let ms;
  try {
    await page.waitForFunction(STEPS[step].done, null, { timeout: 30000, polling: 5 });
    ms = Math.round(performance.now() - start);
  } catch {
    ms = 'FAILED';
  }
  // A body that never arrives does not hold the run.
  await Promise.race([Promise.all(bodies), sleep(3000)]);
  const log = [];
  for (const entry of requests.values()) {
    if (ms === 'FAILED' || entry.start <= ms) {
      log.push({
        url: entry.url,
        start: Math.round(entry.start),
        end: entry.end === undefined ? undefined : Math.round(entry.end),
        raw: entry.raw,
        gzip: entry.gzip,
      });
    }
  }
  await context.close();
  let raw = 0;
  let gzip = 0;
  for (const entry of log) {
    raw += entry.raw ?? 0;
    gzip += entry.gzip ?? 0;
  }
  return { ms, requests: log.length, roundTrips: countRoundTrips(log), raw, gzip, log, errors };
}

function summarize(values) {
  const sorted = values.toSorted((a, b) => a - b);
  function at(q) {
    const index = (sorted.length - 1) * q;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (index - low));
  }
  return {
    n: sorted.length,
    min: sorted[0],
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    max: sorted.at(-1),
  };
}

const VARIANTS = ['split', 'merged', 'parallel'];
const CASES = [
  { step: 'counter', cold: true },
  { step: 'toggle', cold: true },
  { step: 'counter', cold: false },
  { step: 'toggle', cold: false },
];

async function main() {
  if (!flags['no-build']) {
    await buildApp();
  }
  const { sizes, chunks, mergedFile, variants } = await loadVariants();
  const server = await startServer(variants);
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = fromHarness('playwright-core');
  const launch = findChrome();
  if (!launch) {
    throw new Error('No Chrome found. Set CHROME_PATH.');
  }
  const browser = await chromium.launch({ ...launch, headless: true });
  const runs = [];
  const loads = [];
  try {
    for (let round = 0; round < ROUNDS; round++) {
      loads.push({ round, start: os.loadavg()[0] });
      // The order of the variants rotates each round, so drift in load spreads over all three.
      const order = [];
      for (let i = 0; i < VARIANTS.length; i++) {
        order.push(VARIANTS[(round + i) % VARIANTS.length]);
      }
      for (const variant of order) {
        for (const item of CASES) {
          if (process.env.VERBOSE) {
            process.stdout.write(`  ${variant} ${item.step} ${item.cold ? 'cold' : 'idle'}\n`);
          }
          const result = await measureClick(browser, base, { variant, ...item });
          if (process.env.VERBOSE) {
            process.stdout.write(`    ${result.ms} ms ${result.requests} req ${result.errors}\n`);
          }
          runs.push({ round, variant, ...item, ...result });
        }
      }
      loads.at(-1).end = os.loadavg()[0];
      process.stdout.write(`round ${round + 1}/${ROUNDS} load ${loads.at(-1).end.toFixed(2)}\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const table = [];
  for (const item of CASES) {
    for (const variant of VARIANTS) {
      const times = [];
      let sample;
      let failed = 0;
      for (const run of runs) {
        if (run.variant === variant && run.step === item.step && run.cold === item.cold) {
          if (run.ms === 'FAILED') {
            failed++;
          } else {
            times.push(run.ms);
          }
          sample ??= run;
        }
      }
      table.push({
        step: item.step,
        mode: item.cold ? 'cold' : 'idle',
        variant,
        failed,
        ms: summarize(times),
        requests: sample.requests,
        roundTrips: sample.roundTrips,
        raw: sample.raw,
        gzip: sample.gzip,
        log: sample.log,
        errors: sample.errors,
      });
    }
  }
  const report = {
    date: new Date().toISOString(),
    cpu: os.cpus()[0]?.model,
    memory: os.totalmem(),
    node: process.version,
    latency: LATENCY,
    gzip: GZIP,
    rounds: ROUNDS,
    loads,
    sizes,
    chunks,
    mergedFile,
    table,
    runs,
  };
  await mkdir(distDir, { recursive: true });
  await writeFile(
    path.join(distDir, GZIP ? 'results-gzip.json' : 'results.json'),
    JSON.stringify(report, null, 2),
  );

  process.stdout.write(`\nsizes ${JSON.stringify(sizes)}\n\n`);
  process.stdout.write(
    '| click | mode | variant | median | p25-p75 | min-max | requests | RT | JS raw / gzip |\n',
  );
  process.stdout.write('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n');
  for (const row of table) {
    const { ms } = row;
    process.stdout.write(
      `| ${row.step} | ${row.mode} | ${row.variant} | ${ms.median} ms | ${ms.p25}-${ms.p75} | ${ms.min}-${ms.max} | ${row.requests} | ${row.roundTrips} | ${row.raw} B / ${row.gzip} B |` +
        (row.failed > 0 ? ` FAILED ${row.failed}` : '') +
        '\n',
    );
  }
  process.stdout.write('\nwaterfalls (first round)\n');
  for (const row of table) {
    process.stdout.write(
      `${row.step} ${row.mode} ${row.variant}${row.errors.length ? ` errors ${row.errors}` : ''}\n`,
    );
    for (const entry of row.log) {
      process.stdout.write(`  ${entry.start}-${entry.end} ms ${entry.url} ${entry.raw} B\n`);
    }
  }
}

await main();
