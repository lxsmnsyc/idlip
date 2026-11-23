// Live samples of the website, against `vite preview` of its build. The spec starts the server
// itself on `E2E_WEBSITE_PORT` (default 4590). It skips when the website is not built: run
// `pnpm --filter website build` first.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const port = Number(process.env.E2E_WEBSITE_PORT ?? 4590);
const origin = `http://127.0.0.1:${port}`;
const website = fileURLToPath(new URL('../../website/', import.meta.url));
const built = existsSync(`${website}dist/client/live/frame.css`);

test.describe.configure({ mode: 'serial' });
test.skip(!built, 'The website is not built. Run `pnpm --filter website build`.');

let server: ChildProcess | undefined;

async function waitForServer(): Promise<void> {
  for (let tries = 0; tries < 100; tries++) {
    try {
      const response = await fetch(`${origin}/live/frame.css`);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }
  throw new Error(`The website preview did not start on ${origin}`);
}

test.beforeAll(async () => {
  server = spawn(
    './node_modules/.bin/vite',
    [
      'preview',
      '--outDir',
      'dist/client',
      '--port',
      String(port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: website, stdio: 'ignore' },
  );
  await waitForServer();
});

test.afterAll(() => {
  server?.kill();
});

/** The status of the sample at `index` on the page, or `idle` before its script starts. */
async function readStatus(page: Page, index: number): Promise<string> {
  return page
    .locator('[data-live-sample]')
    .nth(index)
    .evaluate((root) => (root instanceof HTMLElement ? (root.dataset.status ?? 'idle') : ''));
}

/** Waits until the frame of the sample at `index` shows run `run` of the edited code. */
async function waitForRun(page: Page, index: number, run: number): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .locator('[data-live-sample] iframe')
          .nth(index)
          .evaluate((frame) =>
            frame instanceof HTMLIFrameElement ? frame.contentDocument?.title : undefined,
          ),
      { timeout: 30_000 },
    )
    .toBe(`Run ${run}`);
}

async function replaceCode(page: Page, index: number, code: string): Promise<void> {
  await page.locator('[data-live-sample] textarea').nth(index).fill(code);
}

test('a reader gets the static frame, which resumes, and loads no compiler', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${origin}/docs/views/`);
  const sample = page.locator('[data-live-sample]').nth(1);
  await sample.scrollIntoViewIfNeeded();
  const frame = sample.locator('iframe').contentFrame();
  await expect(frame.getByRole('button', { name: 'Open' })).toBeVisible();
  await frame.getByRole('button', { name: 'Open' }).click();
  await expect(frame.getByRole('button', { name: 'Close' })).toBeVisible();
  expect(requests.some((url) => url.endsWith('/live/views-2/panel.handler.toggle.js'))).toBe(true);
  expect(requests.some((url) => /\/assets\/(run-|editor-|worker-)|\.wasm$/.test(url))).toBe(false);
  expect(await page.evaluate(async () => navigator.serviceWorker.getRegistrations())).toEqual([]);
});

test('an edit runs again, and two samples run on their own', async ({ page }) => {
  await page.goto(`${origin}/docs/views/`);
  await page.locator('[data-live-sample]').nth(1).scrollIntoViewIfNeeded();
  await replaceCode(
    page,
    1,
    'export default function A() {\n  return <p>Edited {2 * 21}</p>;\n}\n',
  );
  await waitForRun(page, 1, 1);
  const second = page.locator('[data-live-sample] iframe').nth(1).contentFrame();
  await expect(second.locator('p')).toHaveText('Edited 42');

  await replaceCode(page, 0, 'export default function B() {\n  return <p>First</p>;\n}\n');
  await waitForRun(page, 0, 1);
  const first = page.locator('[data-live-sample] iframe').nth(0).contentFrame();
  await expect(first.locator('p')).toHaveText('First');
  // The first run did not take the second sample's chunks or frame.
  await expect(second.locator('p')).toHaveText('Edited 42');
  expect(await readStatus(page, 1)).toBe('ready');
});

test('a compile error shows in place and marks the code', async ({ page }) => {
  await page.goto(`${origin}/docs/views/`);
  const sample = page.locator('[data-live-sample]').nth(1);
  await sample.scrollIntoViewIfNeeded();
  await replaceCode(page, 1, 'export default function A() {\n  return <p>;\n}\n');
  await expect.poll(async () => readStatus(page, 1), { timeout: 30_000 }).toBe('blocked');
  await expect(sample.locator('[data-live-status]')).toHaveText('1 error');
  await expect(sample.locator('.live-problem')).toHaveCount(1);
  await expect(sample.locator('.repl-mark.is-error')).toHaveCount(1);
});

test('a render that does not end times out, and the next edit runs', async ({ page }) => {
  await page.goto(`${origin}/docs/views/`);
  const sample = page.locator('[data-live-sample]').nth(1);
  await sample.scrollIntoViewIfNeeded();
  const loop =
    'function spin(n: number): number {\n  while (n >= 0) {\n    n = n + 1;\n  }\n  return n;\n}\n\nexport default function Loop() {\n  let n = 0;\n  function up() {\n    n = n + 1;\n  }\n  const x = spin(n);\n  return <button on:click={up}>{x}</button>;\n}\n';
  await replaceCode(page, 1, loop);
  await expect(sample.locator('.live-error')).toHaveText('The render did not finish in 5 s.', {
    timeout: 30_000,
  });
  expect(await readStatus(page, 1)).toBe('failed');
  await replaceCode(page, 1, 'export default function A() {\n  return <p>Back</p>;\n}\n');
  await waitForRun(page, 1, 2);
  await expect(sample.locator('.live-error')).toBeHidden();
});
