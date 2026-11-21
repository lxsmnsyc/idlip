import { gzipSync } from 'node:zlib';
import type { Request } from '@playwright/test';
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

test.describe('scripts off', () => {
  test.use({ javaScriptEnabled: false });

  test('the server render works before any script runs', async ({ page }) => {
    await page.goto('/');
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
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  // Pointer movement and focus are not handled events.
  await page.getByRole('checkbox').first().hover();
  await settle(page);
  page.off('request', onRequest);

  const html = (await response?.text()) ?? '';
  const expected = ['document /'];
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
  await page.goto('/', { waitUntil: 'networkidle' });
  const second = page.getByRole('checkbox').nth(1);
  const chunks = await collectRequests(page, async () => {
    await second.click();
    await expect(page.locator('p')).toHaveText('0 left');
  });
  expect(chunks.toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle']);
  expect(await page.evaluate(() => window.idlipDecoded)).toBe(1);
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
