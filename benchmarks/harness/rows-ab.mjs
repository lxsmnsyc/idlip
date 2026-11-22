// Interleaved A/B of rows operations between idlip builds of the rows page.
// Each `--dir` is a folder with a `dist/` from `vite build rows` in `benchmarks/idlip` (copy the
// folder away before building the other side). The first is the baseline.
// Usage: node rows-ab.mjs --dir base=<path> --dir branch=<path> [--runs 9] [--ops create1k,...]
// [--metric paint|cpu]
// A change is real when it is larger than the noise: 3 times the larger median absolute deviation.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';
import { OPERATIONS, measureOperation } from './client.mjs';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', multiple: true },
    runs: { type: 'string', default: '9' },
    ops: { type: 'string', default: 'create1k,replace1k,append1k,create10k' },
    metric: { type: 'string', default: 'paint' },
  },
});

function median(list) {
  const sorted = list.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getDeviation(list) {
  const middle = median(list);
  const gaps = [];
  for (const value of list) {
    gaps.push(Math.abs(value - middle));
  }
  return median(gaps);
}

// Serves one build: the server page at `/` and the client files.
async function serve(root) {
  const dist = path.resolve(root, 'dist');
  const server = await import(path.join(dist, 'server/entry-server.js'));
  const manifest = JSON.parse(
    await readFile(path.join(dist, 'client/.vite/manifest.json'), 'utf8'),
  );
  let loader = '';
  for (const item of Object.values(manifest)) {
    if (item.name === 'loader' && item.isEntry) {
      loader = `/${item.file}`;
    }
  }
  const client = path.join(dist, 'client');
  const http = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    response.setHeader('cache-control', 'no-store');
    try {
      if (url.pathname === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(await server.page(Number(url.searchParams.get('n') ?? 0), loader));
        return;
      }
      const body = await readFile(path.join(client, path.normalize(url.pathname)));
      response.setHeader(
        'content-type',
        url.pathname.endsWith('.js') ? 'text/javascript' : 'text/plain',
      );
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => {
    http.listen(0, '127.0.0.1', resolve);
  });
  return { http, base: `http://127.0.0.1:${http.address().port}` };
}

// Start one server per side, then interleave the sides in every run of every operation.
const sides = [];
for (const entry of values.dir ?? []) {
  const [name, root] = entry.split('=');
  sides.push({ name, ...(await serve(root)) });
}
const browser = await chromium.launch({ ...findChrome(), headless: true });
const runs = Number(values.runs);
const results = {};
for (const key of values.ops.split(',')) {
  results[key] = {};
  for (const side of sides) {
    results[key][side.name] = [];
  }
  for (let run = 0; run < runs + 1; run++) {
    // Rotate the order so neither side always goes first. Run 0 is a warmup.
    for (let index = 0; index < sides.length; index++) {
      const side = sides[(index + run) % sides.length];
      const sample = await measureOperation(browser, side.base, OPERATIONS[key]);
      if (run > 0) {
        results[key][side.name].push(sample[values.metric]);
      }
    }
  }
}
await browser.close();
for (const side of sides) {
  side.http.close();
}

// Print the medians, the deviation and the change against the baseline.
for (const [key, bySide] of Object.entries(results)) {
  const [first, ...rest] = sides;
  const baseline = bySide[first.name];
  const line = [
    `${key.padEnd(10)} ${first.name} ${median(baseline).toFixed(1)} (MAD ${getDeviation(baseline).toFixed(1)})`,
  ];
  for (const side of rest) {
    const list = bySide[side.name];
    const change = (median(list) - median(baseline)) / median(baseline);
    const noise = 3 * Math.max(getDeviation(list), getDeviation(baseline));
    const real = Math.abs(median(list) - median(baseline)) > noise;
    line.push(
      `${side.name} ${median(list).toFixed(1)} (MAD ${getDeviation(list).toFixed(1)}) ${(change * 100).toFixed(1)}% noise ${noise.toFixed(1)} ${real ? 'real' : 'within noise'}`,
    );
  }
  console.log(line.join(' | '));
}
console.log(JSON.stringify(results));
