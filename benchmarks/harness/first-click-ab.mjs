// Interleaved A/B of the first click after idle between idlip builds of the todos or dashboard
// page. The "idle" run of the waterfall metric: load, wait for the network to go quiet and
// `--idle` ms more, throttle the network to `--latency`, click, and time the click to the update.
// It reports two times: "click to update" as the harness measures it (from the Playwright click
// call to the check passing, polled every 5 ms), and by the page's own clock from the click event,
// which leaves out the Playwright round trips: "click to write" (the first DOM change) and "click
// to the frame after the write".
//
// Each `--side` is `name=<dist>` or `name=<dist>:off`, where `<dist>` is the `dist/` folder of a
// build (`benchmarks/idlip/dist` for todos, `benchmarks/idlip/dashboard/dist` for the dashboard,
// copied away before building the next side). `:off` renders the page without preload links
// (`page(..., false)`). The first side is the baseline.
//
// Usage: node first-click-ab.mjs --scenario todos|dashboard --side base=<dist> --side
// branch=<dist> [--runs 21] [--idle 1000] [--latency 150]
//
// A change is real when it is larger than the noise: 3 times the larger median absolute deviation.
// Fix `--runs` before the run and keep the result, so the verdict does not depend on stopping.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { loadavg } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { measureFirstClick } from './browser.mjs';
import { findChrome } from './chrome.mjs';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'todos' },
    side: { type: 'string', multiple: true },
    runs: { type: 'string', default: '21' },
    idle: { type: 'string', default: '1000' },
    latency: { type: 'string', default: '150' },
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

async function findLoader(dist) {
  const manifest = JSON.parse(
    await readFile(path.join(dist, 'client/.vite/manifest.json'), 'utf8'),
  );
  for (const item of Object.values(manifest)) {
    if (item.name === 'loader' && item.isEntry) {
      return `/${item.file}`;
    }
  }
  throw new Error(`${dist} has no loader entry`);
}

// Serves one build: the page at `/` and the client files.
async function serve(dist, preload) {
  const server = await import(path.join(dist, 'server/entry-server.js'));
  const loader = await findLoader(dist);
  const client = path.join(dist, 'client');
  const http = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    response.setHeader('cache-control', 'no-store');
    try {
      if (url.pathname === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(
          values.scenario === 'dashboard'
            ? await server.page(loader, preload)
            : await server.page(Number(url.searchParams.get('n') ?? 3), loader, preload),
        );
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

function printLoad(when) {
  const parts = [];
  for (const value of loadavg()) {
    parts.push(value.toFixed(2));
  }
  console.log(`load average ${when}: ${parts.join(' ')}`);
}

// Start one server per side, then interleave the sides in every run. The browser and the servers
// close on an error too.
printLoad('at the start');
const sides = [];
const results = {};
const writes = {};
const frames = {};
const requests = {};
let browser;
try {
  for (const entry of values.side ?? []) {
    const [name, spec] = entry.split('=');
    const off = spec.endsWith(':off');
    const dist = path.resolve(off ? spec.slice(0, -':off'.length) : spec);
    sides.push({ name, ...(await serve(dist, !off)) });
    results[name] = [];
    writes[name] = [];
    frames[name] = [];
    requests[name] = [];
  }
  browser = await chromium.launch({ ...findChrome(), headless: true });
  const options = {
    scenario: values.scenario,
    latency: Number(values.latency),
    idleMs: Number(values.idle),
  };
  const runs = Number(values.runs);
  for (let run = 0; run < runs + 1; run++) {
    // Rotate the order so no side always goes first. Run 0 is a warmup.
    for (let index = 0; index < sides.length; index++) {
      const side = sides[(index + run) % sides.length];
      const sample = await measureFirstClick(browser, side.base, options);
      if (sample.ms === 'FAILED') {
        throw new Error(`${side.name}: the click did not update the page`);
      }
      if (run > 0) {
        results[side.name].push(sample.ms);
        writes[side.name].push(Math.round(sample.write.write * 10) / 10);
        frames[side.name].push(Math.round(sample.write.frame * 10) / 10);
        requests[side.name].push(sample.requests);
      }
    }
  }
} finally {
  await browser?.close();
  for (const side of sides) {
    side.http.close();
  }
}
printLoad('at the end');

// Print the medians, the deviation and the change against the baseline, for each metric.
console.log(
  `${values.scenario}, first click after ${values.idle} ms idle, ${values.latency} ms latency, ${values.runs} runs`,
);
function report(title, bySide) {
  console.log(title);
  const [first, ...rest] = sides;
  const baseline = bySide[first.name];
  console.log(
    `  ${first.name} ${median(baseline).toFixed(1)} ms (MAD ${getDeviation(baseline).toFixed(1)}), ${median(requests[first.name])} requests`,
  );
  for (const side of rest) {
    const list = bySide[side.name];
    const change = (median(list) - median(baseline)) / median(baseline);
    const noise = 3 * Math.max(getDeviation(list), getDeviation(baseline));
    const real = Math.abs(median(list) - median(baseline)) > noise;
    console.log(
      `  ${side.name} ${median(list).toFixed(1)} ms (MAD ${getDeviation(list).toFixed(1)}), ${median(requests[side.name])} requests, ${(change * 100).toFixed(1)}% noise ${noise.toFixed(1)} ${real ? 'real' : 'within noise'}`,
    );
  }
}
report('click to update (harness)', results);
report('click to write (page clock)', writes);
report('click to the frame after the write (page clock)', frames);
console.log(JSON.stringify({ results, writes, frames, requests }));
