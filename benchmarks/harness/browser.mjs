import { gzipSync } from 'node:zlib';
import { COUNT_ARG } from './count.mjs';
import { CLICKS, expected, widgets } from './dashboard.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isScript(entry) {
  return entry.type === 'script' || /\.m?js(\?|$)/.test(entry.url);
}

// These two run in the page. They rebuild the count reader from its source, because a function
// sent to the page cannot use imports. The tests run them against a DOM.
export function prepareLeft({ source }) {
  window.__left = new Function(`return (${source})`)()(document);
}

export function toggleDone({ source }) {
  const left = new Function(`return (${source})`)()(document);
  return (
    left === window.__left - 1 && document.querySelectorAll('ul li')[1].className.includes('done')
  );
}

// The interactions. Each one has an action and a check that runs in the page.
const INTERACTIONS = {
  counter: {
    run: (page) => page.locator('h2 + button').click(),
    done: () =>
      document.querySelector('h2 + button').textContent.includes('Clicked 1 times') &&
      document.body.textContent.includes('Double: 2'),
  },
  toggle: {
    run: (page) => page.locator('ul li button').nth(1).click(),
    arg: COUNT_ARG,
    done: toggleDone,
  },
  add: {
    run: async (page) => {
      await page.locator('input').fill('New item');
      await page.locator('form button').click();
    },
    done: () =>
      document.querySelector('ul li:last-child').textContent.includes('New item') &&
      document.querySelector('input').value === '',
  },
};

function total(entries) {
  let jsFiles = 0;
  let jsRaw = 0;
  let jsGzip = 0;
  for (const entry of entries) {
    if (!isScript(entry)) {
      continue;
    }
    jsFiles++;
    jsRaw += entry.raw;
    jsGzip += entry.gzip;
  }
  return { requests: entries.length, jsFiles, jsRaw, jsGzip };
}

// Loads the page, waits while idle, then runs the steps in order. Records every request with
// the phase in which it started. Each step has a `name`, a `run(page)` and a `done(arg)` that
// runs in the page.
async function run(browser, base, pageUrl, steps, { idleMs, prepare, prepareArg }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const log = [];
  const pending = [];
  const phaseOf = new Map();
  let phase = 'boot';
  page.on('request', (request) => phaseOf.set(request, phase));
  page.on('response', (response) => {
    const url = response.url();
    if (!url.startsWith(base) || url === pageUrl) {
      return;
    }
    pending.push(
      response.body().then(
        (body) =>
          log.push({
            phase: phaseOf.get(response.request()),
            url: url.slice(base.length),
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

  await page.goto(pageUrl, { waitUntil: 'load' });
  phase = 'idle';
  await page.waitForLoadState('networkidle');
  await sleep(idleMs);
  if (prepare) {
    await page.evaluate(prepare, prepareArg);
  }

  const checks = {};
  for (const step of steps) {
    phase = step.name;
    const start = performance.now();
    await step.run(page);
    try {
      await page.waitForFunction(step.done, step.arg, { timeout: 5000 });
      checks[step.name] = Math.round(performance.now() - start);
    } catch {
      checks[step.name] = 'FAILED';
    }
    await sleep(1000);
  }
  await Promise.all(pending);
  await context.close();

  const order = [];
  for (const step of steps) {
    order.push(step.name);
  }
  const phases = {};
  for (const name of ['boot', 'idle', ...order]) {
    const inPhase = [];
    for (const entry of log) {
      if (entry.phase === name) {
        inPhase.push(entry);
      }
    }
    phases[name] = total(inPhase);
  }
  return { order, checks, errors, phases, all: total(log), log };
}

function session(browser, base, order, { idleMs, n }) {
  const steps = [];
  for (const name of order) {
    steps.push({ name, ...INTERACTIONS[name] });
  }
  return run(browser, base, `${base}/?n=${n}`, steps, {
    idleMs,
    prepareArg: COUNT_ARG,
    prepare: prepareLeft,
  });
}

function failures(sessions) {
  const failed = [];
  for (const s of sessions) {
    for (const [name, value] of Object.entries(s.checks)) {
      if (value === 'FAILED') {
        failed.push(`${name} (${s.order[0]} first)`);
      }
    }
  }
  return failed;
}

export async function measureBrowser(browser, base, options) {
  const counterFirst = await session(browser, base, ['counter', 'toggle', 'add'], options);
  const toggleFirst = await session(browser, base, ['toggle', 'counter', 'add'], options);
  const failed = failures([counterFirst, toggleFirst]);
  return {
    boot: counterFirst.phases.boot,
    idle: counterFirst.phases.idle,
    firstCounter: counterFirst.phases.counter,
    firstToggle: toggleFirst.phases.toggle,
    total: counterFirst.all,
    checks: { counterFirst: counterFirst.checks, toggleFirst: toggleFirst.checks },
    failed,
    errors: [...new Set([...counterFirst.errors, ...toggleFirst.errors])],
    sessions: { counterFirst, toggleFirst },
  };
}

// Counts the sequential network round trips between a click and the DOM update.
// A request is one trip deeper than the deepest request that finished before it started.
function roundTrips(requests) {
  const sorted = requests.toSorted((a, b) => a.start - b.start);
  let max = 0;
  for (const request of sorted) {
    const depths = [];
    for (const other of sorted) {
      if (other !== request && other.end !== undefined && other.end <= request.start) {
        depths.push(other.depth ?? 1);
      }
    }
    request.depth = 1 + Math.max(0, ...depths);
    max = Math.max(max, request.depth);
  }
  return max;
}

// Runs in the page before the click. By the page's own clock, from the click event: the first
// DOM change after it (`window.__write`), and the frame that shows it (`window.__frame`, a task
// queued from the next animation frame, so the frame has rendered).
function installWriteTimer() {
  let clicked = 0;
  document.addEventListener('click', (event) => (clicked = event.timeStamp), { capture: true });
  new MutationObserver(() => {
    if (clicked !== 0 && window.__write === undefined) {
      window.__write = performance.now() - clicked;
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.__frame = performance.now() - clicked;
        });
      });
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
}

// Clicks on a throttled network and records the requests until the update.
// "idle": the page loads, idles, then the network slows down before the click.
// "cold": the network is slow from the start and the click comes right after load.
async function waterfallRun(browser, base, { latency, idleMs, cold, url, step, timeWrite }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  function throttle() {
    return cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  if (cold) {
    await throttle();
  }
  await page.goto(url, { waitUntil: 'load' });
  if (!cold) {
    await page.waitForLoadState('networkidle');
    await sleep(idleMs);
    await throttle();
  }
  const requests = new Map();
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
  if (timeWrite) {
    await page.evaluate(installWriteTimer);
  }
  start = performance.now();
  await step.run(page);
  let ms;
  try {
    await page.waitForFunction(step.done, step.arg, { timeout: 30000, polling: 5 });
    ms = Math.round(performance.now() - start);
  } catch {
    ms = 'FAILED';
  }
  let write;
  if (timeWrite && ms !== 'FAILED') {
    await page.waitForFunction(() => window.__frame !== undefined);
    write = await page.evaluate(() => ({ write: window.__write, frame: window.__frame }));
  }
  const list = [];
  for (const entry of requests.values()) {
    if (ms === 'FAILED' || entry.start <= ms) {
      list.push(entry);
    }
  }
  await context.close();
  return { ms, write, requests: list.length, roundTrips: roundTrips(list), log: list };
}

async function waterfall(browser, base, options) {
  return {
    idle: await waterfallRun(browser, base, { ...options, cold: false }),
    cold: await waterfallRun(browser, base, { ...options, cold: true }),
  };
}

export function measureWaterfall(browser, base, options) {
  return waterfall(browser, base, {
    ...options,
    url: `${base}/?n=3`,
    step: { arg: null, ...INTERACTIONS.counter },
  });
}

// --- Dashboard -------------------------------------------------------------------

// A click on the "run" or "mode" button of a widget, done when the widget shows what the
// same handler computes in Node.
function click(key, button) {
  const widget = widgets()[CLICKS[key]];
  const want = expected(widget, button);
  return {
    name: key,
    run: (page) => page.locator(`#${widget.id} .${button === 'run' ? 'run' : 'mode'}`).click(),
    arg: { id: widget.id, ...want },
    // The output, the mode, the summary and every list item must match the Node result.
    done: ({ id, output, mode, summary, items }) => {
      const root = document.getElementById(id);
      const shown = [];
      for (const li of root.querySelectorAll('ul li')) {
        shown.push(li.textContent.trim());
      }
      return (
        root.querySelector('.out').textContent === output &&
        root.querySelector('.mode').textContent.trim() === mode &&
        root.querySelector('.summary').textContent.trim() === summary &&
        shown.join(',') === items.join(',')
      );
    },
  };
}

// Scrolls a widget into view. The session then waits 1 s, as it does after every step, so code
// that loads when an element comes near the viewport has time to arrive before the click.
function scroll(key) {
  const { id } = widgets()[CLICKS[key]];
  return {
    name: `scroll-${key}`,
    run: (page) => page.locator(`#${id}`).scrollIntoViewIfNeeded(),
    arg: null,
    done: () => true,
  };
}

function MAIN() {
  return [
    click('above', 'run'),
    scroll('below'),
    click('below', 'run'),
    scroll('third'),
    click('third', 'cycle'),
  ];
}

function summary(s) {
  return (
    s && {
      boot: s.phases.boot,
      idle: s.phases.idle,
      above: s.phases.above,
      scrollBelow: s.phases['scroll-below'],
      below: s.phases.below,
      scrollThird: s.phases['scroll-third'],
      third: s.phases.third,
      total: s.all,
      checks: s.checks,
    }
  );
}

function sessionErrors(sessions) {
  const errors = [];
  for (const s of sessions) {
    errors.push(...s.errors);
  }
  return errors;
}

export async function measureDashboard(browser, base, { idleMs, preloadOption }) {
  const options = { idleMs };
  const main = await run(browser, base, `${base}/`, MAIN(), options);
  const below = await run(browser, base, `${base}/`, [scroll('below'), click('below', 'run')], {
    idleMs,
  });
  const off = preloadOption
    ? await run(browser, base, `${base}/?preload=off`, MAIN(), options)
    : undefined;
  const sessions = [main, below];
  if (off) {
    sessions.push(off);
  }
  return {
    ...summary(main),
    belowFirst: {
      scroll: below.phases['scroll-below'],
      click: below.phases.below,
      checks: below.checks,
    },
    preloadOff: summary(off),
    failed: failures(sessions),
    errors: [...new Set(sessionErrors(sessions))],
    sessions: { main, belowFirst: below, preloadOff: off },
  };
}

export function measureDashboardWaterfall(browser, base, options) {
  return waterfall(browser, base, { ...options, url: `${base}/`, step: click('above', 'run') });
}

// One first click after idle on a throttled network, the "idle" run of the waterfall: the
// counter of the todos page, or widget 1 of the dashboard. `first-click-ab.mjs` interleaves it.
export function measureFirstClick(browser, base, { scenario, latency, idleMs }) {
  const options = { latency, idleMs, cold: false, timeWrite: true };
  if (scenario === 'dashboard') {
    return waterfallRun(browser, base, {
      ...options,
      url: `${base}/`,
      step: click('above', 'run'),
    });
  }
  return waterfallRun(browser, base, {
    ...options,
    url: `${base}/?n=3`,
    step: { arg: null, ...INTERACTIONS.counter },
  });
}
