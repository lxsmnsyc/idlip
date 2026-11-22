import { gzipSync } from 'node:zlib';
import type { Request } from '@playwright/test';
import getChunkName from '../fixture/chunk.ts';
import {
  collectRequests,
  expect,
  initial,
  labelRequest,
  readLoaderFiles,
  readMain,
  renderFresh,
  settle,
  test,
} from './support.ts';

// Contract budgets (compiled-format, Listener and early events), `gzip -9`.
const listenerBudget = 1024;
const loaderBudget = 4096;

// The example page preloads the chunks of the first click. `?preload=off` leaves the links out,
// so the tests of the loading path see the loader fetch the chunks itself.
const NO_PRELOAD = '/?preload=off';

test.describe('scripts off', () => {
  test.use({ javaScriptEnabled: false });

  test('the server render works before any script runs', async ({ page }) => {
    // With scripts off, Chromium cancels the module preloads, and each would count as a failed
    // request.
    await page.goto(NO_PRELOAD);
    await expect(page.getByText('Write the format')).toBeVisible();
    await expect(page.getByText('Build <the> runtime')).toBeVisible();
    await expect(page.locator('p')).toHaveText('1 left');
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();
  });
});

test.describe('csp probe', () => {
  // The probe provokes one console error on purpose.
  test.use({ expectedProblems: 1 });

  test('the page runs under a strict CSP', async ({ page, problems }) => {
    const response = await page.goto('/');
    const policy = response?.headers()['content-security-policy'] ?? '';
    expect(policy).toMatch(/script-src 'nonce-[\w+/=]+' 'strict-dynamic'/);
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('trusted-types idlip');
    // The page's own scripts raised no violation.
    expect(await page.evaluate(() => window.idlipViolations)).toEqual([]);
    // A script without the nonce is blocked, and so is a Trusted Types sink fed a string.
    const outcome = await page.evaluate(() => {
      const script = document.createElement('script');
      try {
        script.textContent = 'window.injected = true';
      } catch {
        return 'trusted-types';
      }
      return 'allowed';
    });
    expect(outcome).toBe('trusted-types');
    const injected: unknown = await page.evaluate((): unknown => Reflect.get(window, 'injected'));
    expect(injected).toBeUndefined();
    // The blocked assignment is the one expected console error.
    expect(problems).toHaveLength(1);
  });
});

test('only the page and the loader load before the first event', async ({ page, baseURL }) => {
  // Every request from the navigation on, so an eager import in the loader shows up too.
  const requests: string[] = [];
  function onRequest(request: Request): void {
    requests.push(labelRequest(request));
  }
  page.on('request', onRequest);
  const response = await page.goto(NO_PRELOAD, { waitUntil: 'networkidle' });
  // Pointer movement and focus are not handled events.
  await page.getByRole('checkbox').first().hover();
  await settle(page);
  page.off('request', onRequest);

  const html = (await response?.text()) ?? '';
  const expected = [`document ${NO_PRELOAD}`];
  for (const url of (await readLoaderFiles(page, html, baseURL ?? '')).keys()) {
    const { pathname, search } = new URL(url);
    expected.push(`script ${pathname}${search}`);
  }
  expect(requests.toSorted()).toEqual(expected.toSorted());
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(0);
});

test('the first click loads the toggle chunk and the changed binding chunk only', async ({
  page,
}) => {
  await page.goto(NO_PRELOAD, { waitUntil: 'networkidle' });
  const second = page.getByRole('checkbox').nth(1);
  const chunks = await collectRequests(page, async () => {
    await second.click();
    await expect(page.locator('p')).toHaveText('0 left');
  });
  // A build also loads the helpers module the chunks share. The fixture's chunks import none.
  const helpers = process.env.E2E_TARGET === 'fixture' ? [] : ['helpers'];
  expect(chunks.toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle', ...helpers]);
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(1);
});

test('the first click requests every file before any arrives, so it is one round trip', async ({
  page,
}) => {
  await page.goto(NO_PRELOAD, { waitUntil: 'networkidle' });
  // The loader asks for the helpers module with the chunks. Found as an import of a chunk, it
  // would be requested only after that chunk arrived.
  const finished: Request[] = [];
  function onFinished(request: Request): void {
    finished.push(request);
  }
  page.on('requestfinished', onFinished);
  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');
  await settle(page);
  page.off('requestfinished', onFinished);

  const names: string[] = [];
  let lastStart = 0;
  let firstEnd = Infinity;
  for (const request of finished) {
    names.push(getChunkName(request.url()) ?? request.url());
    const timing = request.timing();
    lastStart = Math.max(lastStart, timing.startTime);
    firstEnd = Math.min(firstEnd, timing.startTime + timing.responseEnd);
  }
  const helpers = process.env.E2E_TARGET === 'fixture' ? [] : ['helpers'];
  expect(names.toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle', ...helpers]);
  // Every request started before the earliest response ended.
  expect(lastStart).toBeLessThan(firstEnd);
});

test('a helpers module that fails to load once costs at most the first patch', async ({
  page,
  problems,
}) => {
  test.skip(process.env.E2E_TARGET === 'fixture', 'the fixture serves no helpers module');
  let requested = 0;
  await page.route('**/assets/*.js', async (route) => {
    if (getChunkName(route.request().url()) === 'helpers' && requested++ === 0) {
      // Failing a little later makes the binding chunk's static import wait on this fetch, so
      // the binding chunk fails with it. Failing at once, Chromium fetches the helpers again
      // for the chunk, and the first click applies.
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto(NO_PRELOAD, { waitUntil: 'networkidle' });
  await page.getByRole('checkbox').nth(1).click();
  await settle(page);

  // The next event asks for a failed chunk under a new URL. Chromium keeps no failed module
  // fetch, so the chunk's import fetches the helpers again, and the patch brings the DOM to
  // the model of both clicks.
  await page.getByRole('checkbox').first().click();
  await expect(page.locator('p')).toHaveText('1 left');
  await settle(page);
  expect(requested).toBeGreaterThan(1);
  const both = [
    { ...initial[0], done: false },
    { ...initial[1], done: true },
  ];
  expect(await readMain(page)).toBe(await renderFresh(page, both));

  // The aborted fetch, and the binding chunk when it failed with it, are the only problems.
  for (const problem of problems) {
    expect(problem).toMatch(/_idlip-helpers|ERR_FAILED|Failed to fetch dynamically imported/);
  }
  problems.length = 0;
});

test('the preload links fetch the first click chunks with the page, so the click fetches nothing', async ({
  page,
}) => {
  test.skip(process.env.E2E_TARGET === 'fixture', 'the fixture page has no preload links');
  const loaded = await collectRequests(page, async () => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });
  const names: string[] = [];
  for (const name of loaded) {
    if (!name.startsWith('/')) {
      names.push(name);
    }
  }
  expect(names.toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle', 'helpers']);
  const chunks = await collectRequests(page, async () => {
    await page.getByRole('checkbox').nth(1).click();
    await expect(page.locator('p')).toHaveText('0 left');
  });
  expect(chunks).toEqual([]);
  // The preloads raised no CSP violation under the page's nonce policy.
  expect(await page.evaluate(() => window.idlipViolations)).toEqual([]);
});

test('a later click on the same handler loads nothing', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');
  const chunks = await collectRequests(page, async () => {
    await page.getByRole('checkbox').first().click();
    await expect(page.locator('p')).toHaveText('1 left');
  });
  expect(chunks).toEqual([]);
  // The state decoded once, for the first event.
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(1);
});

test('a click before the page scripts finish loading still applies', async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Hold every script request, so the click lands before any module runs.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      await held;
    }
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  const second = page.getByRole('checkbox').nth(1);
  await second.waitFor();
  await second.click();
  // Nothing has patched yet, and the listener has queued the event.
  await expect(page.locator('p')).toHaveText('1 left');
  release();
  await expect(page.locator('p')).toHaveText('0 left');
  await expect(second).toBeChecked();
});

test('the DOM after each action equals a fresh server render', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');
  const afterFirst = initial.map((todo) => ({ ...todo, done: true }));
  expect(await readMain(page)).toBe(await renderFresh(page, afterFirst));

  await page.getByRole('checkbox').first().click();
  await expect(page.locator('p')).toHaveText('1 left');
  const afterSecond = [
    { ...initial[0], done: false },
    { ...initial[1], done: true },
  ];
  expect(await readMain(page)).toBe(await renderFresh(page, afterSecond));
});

test('typing, Escape and submit add a todo that toggles', async ({ page }) => {
  // The fixture's stub loader does not patch lists.
  test.skip(process.env.E2E_TARGET === 'fixture', 'needs the real list patcher');
  await page.goto('/', { waitUntil: 'networkidle' });
  const input = page.locator('main input').first();

  await input.fill('Dropped');
  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(page.locator('button')).toBeDisabled();

  await input.fill('Ship <it>');
  await expect(page.locator('button')).toBeEnabled();
  await input.press('Enter');
  await expect(page.locator('li')).toHaveCount(3);
  await expect(input).toHaveValue('');
  await expect(page.locator('p')).toHaveText('2 left');
  const added = [...initial, { id: 't3', text: 'Ship <it>', done: false }];
  expect(await readMain(page)).toBe(await renderFresh(page, added));

  await page.getByRole('checkbox').nth(2).click();
  await expect(page.locator('p')).toHaveText('1 left');
  const toggled = [...initial, { id: 't3', text: 'Ship <it>', done: true }];
  expect(await readMain(page)).toBe(await renderFresh(page, toggled));
});

function gzipSize(code: string): number {
  return gzipSync(code, { level: 9 }).length;
}

test('the listener and the loader stay within their gzip budgets', async ({ page, baseURL }) => {
  const response = await page.request.get('/');
  const html = await response.text();

  // The listener is the inline script in the head that is neither the import map nor a module.
  const inline = [
    ...html.matchAll(/<script(?![^>]*(?:src=|type=|i-state))[^>]*>([\s\S]*?)<\/script>/g),
  ];
  expect(inline).toHaveLength(1);
  expect(gzipSize(inline[0][1])).toBeLessThanOrEqual(listenerBudget);

  // The loader is the module script, counted with its static imports.
  let total = 0;
  for (const code of (await readLoaderFiles(page, html, baseURL ?? '')).values()) {
    total += gzipSize(code);
  }
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(loaderBudget);
});
