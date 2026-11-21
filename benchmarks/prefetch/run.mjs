// Node `prefetch`: the cold first click of the idlip bench app with and without
// `renderPreload` links in the head, rounds interleaved on one browser.
//
//   off  The page of `benchmarks/idlip` as it is.
//   on   The same page with `renderPreload(chunks, manifests)` links after the charset.
//
// Each round throttles the network (150 ms latency, about 1.6 Mbit/s, the harness settings),
// loads the page, clicks the counter right at `load` and waits for `Clicked 1 times`. It
// records the ms from the click to the update (the number of `benchmarks/harness`), the ms from
// the start of the navigation to the update, and the requests of the click.
//
//   node benchmarks/prefetch/run.mjs [--rounds 20] [--latency 150] [--no-build]
//
// It needs `pnpm --filter idlip build` first.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { findChrome } from '../harness/chrome.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '../idlip');
const fromHarness = createRequire(path.join(here, '../harness/package.json'));

const { values: flags } = parseArgs({
  options: {
    rounds: { type: 'string', default: '20' },
    latency: { type: 'string', default: '150' },
    'no-build': { type: 'boolean', default: false },
  },
});
const ROUNDS = Number(flags.rounds);
const LATENCY = Number(flags.latency);

if (!flags['no-build']) {
  execFileSync('pnpm', ['run', 'build'], { cwd: appDir, stdio: 'inherit' });
}

const adapter = await import(path.join(appDir, 'adapter.js'));
const app = await adapter.load();
const { renderPreload } = await import(
  pathToFileURL(path.join(here, '../../packages/idlip/dist/server/index.js')).href
);

// Reads the manifest and the chunk URLs from the state script of a rendered page.
function readState(html) {
  const match = /<script i-state[^>]*>([\s\S]*?)<\/script>/.exec(html);
  const self = {};
  new Function('self', match[1])(self);
  return self.$idlip[0][1]();
}

function withPreload(html) {
  const state = readState(html);
  const links = renderPreload(state.chunks, [
    state.manifest,
    ...Object.values(state.modules ?? {}),
  ]);
  return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">${links}`);
}

const TYPES = { '.js': 'text/javascript', '.json': 'application/json' };

function serve(variant) {
  const root = path.resolve(app.staticDir);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    response.setHeader('cache-control', 'no-store');
    try {
      if (url.pathname === '/') {
        const html = await app.render(3);
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(variant === 'on' ? withPreload(html) : html);
        return;
      }
      const file = path.join(root, path.normalize(decodeURIComponent(url.pathname)));
      const body = await readFile(file);
      response.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` }),
    );
  });
}

async function round(browser, base) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: LATENCY,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  const requests = [];
  let clicked = false;
  page.on('request', (request) => {
    if (clicked) {
      requests.push(request.url().slice(base.length));
    }
  });
  const t0 = performance.now();
  await page.goto(`${base}/?n=3`, { waitUntil: 'load' });
  const tLoad = performance.now();
  clicked = true;
  const start = performance.now();
  await page.locator('h2 + button').click();
  await page.waitForFunction(
    () =>
      document.querySelector('h2 + button').textContent.includes('Clicked 1 times') &&
      document.body.textContent.includes('Double: 2'),
    null,
    { timeout: 30000, polling: 5 },
  );
  const end = performance.now();
  await context.close();
  return {
    click: Math.round(end - start),
    total: Math.round(end - t0),
    load: Math.round(tLoad - t0),
    requests,
  };
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function summarize(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted.at(-1),
  };
}

const launch = findChrome({});
if (!launch) {
  throw new Error('No Chrome found');
}
const { chromium } = fromHarness('playwright-core');
const browser = await chromium.launch({ ...launch, headless: true });
const servers = { off: await serve('off'), on: await serve('on') };
const loadStart = os.loadavg()[0];
const samples = { off: [], on: [] };
const loads = [];
try {
  // One round of each first, which warms Chrome. It is not counted.
  await round(browser, servers.off.base);
  for (let i = 0; i < ROUNDS; i++) {
    const order = i % 2 === 0 ? ['off', 'on'] : ['on', 'off'];
    for (const variant of order) {
      samples[variant].push(await round(browser, servers[variant].base));
    }
    loads.push(os.loadavg()[0]);
  }
} finally {
  await browser.close();
  for (const { server } of Object.values(servers)) {
    server.close();
  }
}

const result = { rounds: ROUNDS, latency: LATENCY, cpus: os.cpus().length, loadStart, loads };
for (const variant of ['off', 'on']) {
  result[variant] = {
    click: summarize(samples[variant].map((s) => s.click)),
    total: summarize(samples[variant].map((s) => s.total)),
    load: summarize(samples[variant].map((s) => s.load)),
    requestsOfClick: samples[variant][0].requests,
    samples: samples[variant],
  };
}
await mkdir(path.join(here, 'dist'), { recursive: true });
await writeFile(path.join(here, 'dist/results.json'), `${JSON.stringify(result, null, 2)}\n`);

console.log(
  `rounds ${ROUNDS}, ${LATENCY} ms latency, load average ${loadStart.toFixed(2)} at start, ${Math.min(...loads).toFixed(2)} to ${Math.max(...loads).toFixed(2)} across rounds, ${os.cpus().length} cores`,
);
for (const variant of ['off', 'on']) {
  const r = result[variant];
  const f = (s) => `${s.median} (${s.p25}-${s.p75}) ${s.min}-${s.max}`;
  console.log(
    `${variant.padEnd(3)} click ${f(r.click)} | navigation to update ${f(r.total)} | load ${f(r.load)}`,
  );
  console.log(`    requests at the click: ${JSON.stringify(r.requestsOfClick)}`);
}
