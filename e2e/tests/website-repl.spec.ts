// The REPL and the live samples of the website run reader code in a frame without an origin.
// Against `vite preview` of the website build, which the spec starts itself on
// `E2E_WEBSITE_REPL_PORT` (default 4591). It skips when the website is not built: run
// `pnpm --filter website build` first.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { FrameLocator, Page } from '@playwright/test';

const port = Number(process.env.E2E_WEBSITE_REPL_PORT ?? 4591);
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

/**
 * A component whose click handler is hostile: it tries the page, the site's storage and its
 * cookies, and shows what it found. A frame on the site's origin reads all three.
 */
const PROBE = `export default function Probe() {
  let report = 'idle';
  function probe() {
    const found: string[] = [];
    try {
      found.push('document:' + window.parent.document.title);
    } catch {
      found.push('document:blocked');
    }
    try {
      found.push('storage:' + window.localStorage.getItem('site-secret'));
    } catch {
      found.push('storage:blocked');
    }
    try {
      found.push('cookie:' + document.cookie);
    } catch {
      found.push('cookie:blocked');
    }
    try {
      found.push('top:' + window.top.location.href);
    } catch {
      found.push('top:blocked');
    }
    found.push('origin:' + window.origin);
    report = found.join(' ');
  }
  return <button on:click={probe}>{report}</button>;
}
`;

const BLOCKED = 'document:blocked storage:blocked cookie:blocked top:blocked origin:null';

/** Gives the site a secret in its storage and cookies, which the probe must not read. */
async function plantSecrets(page: Page): Promise<void> {
  await page.goto(`${origin}/repl/`);
  await page.evaluate(() => {
    localStorage.setItem('site-secret', 'leaked');
    // oxlint-disable-next-line unicorn/no-document-cookie
    document.cookie = 'site-secret=leaked';
  });
}

function getShareHash(source: string): string {
  const pairs = [['probe.tsx', source]];
  return `#files=${Buffer.from(JSON.stringify(pairs)).toString('base64url')}`;
}

function getReplFrame(page: Page): FrameLocator {
  return page.locator('[data-repl-frame]').contentFrame();
}

test('the REPL frame is sandboxed without an origin', async ({ page }) => {
  await plantSecrets(page);
  await page.goto(`${origin}/repl/${getShareHash(PROBE)}`);
  // The same page with a new hash only changes the hash. Load it afresh.
  await page.reload();
  await page.locator('[data-repl-run]').click();
  const frame = getReplFrame(page);
  const sandbox = await page.locator('[data-repl-frame]').getAttribute('sandbox');
  expect(sandbox).toBe('allow-scripts');

  await frame.getByRole('button', { name: 'idle' }).click();
  await expect(frame.getByRole('button')).toHaveText(BLOCKED);

  // The site's own storage and cookies are untouched.
  const kept = await page.evaluate(() => ({
    storage: window.localStorage.getItem('site-secret'),
    cookie: document.cookie,
  }));
  expect(kept).toEqual({ storage: 'leaked', cookie: 'site-secret=leaked' });
});

test('a share link still runs, resumes and lists its chunks', async ({ page }) => {
  await page.goto(`${origin}/repl/#example=counter`);
  const frame = getReplFrame(page);
  await expect(page.locator('[data-repl-status]')).toContainText('Resumed');
  await expect(frame.locator('output')).toHaveText('0');
  await frame.getByRole('button', { name: '+' }).click();
  await expect(frame.locator('output')).toHaveText('1');
  // The panel lists the chunks of the click, not of the load.
  await expect(page.locator('[data-net-events]')).toContainText('counter.handler.increment.js');
  await expect(page.locator('[data-net-load]')).not.toContainText('counter.handler');
  // The frame keeps the theme of the page, which goes by message.
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await expect.poll(async () => frame.locator('html').getAttribute('data-theme')).toBe('dark');
});

test('a live sample frame runs edits without an origin, and the static frame does not run reader code', async ({
  page,
}) => {
  await plantSecrets(page);
  await page.goto(`${origin}/docs/views/`);
  const sample = page.locator('[data-live-sample]').nth(1);
  await sample.scrollIntoViewIfNeeded();
  const frameElement = sample.locator('iframe');
  // The static frame is the site's own build: no sandbox, so it stays on the origin.
  expect(await frameElement.getAttribute('sandbox')).toBeNull();

  await sample.locator('textarea').fill(PROBE);
  await expect(frameElement).toHaveAttribute('sandbox', 'allow-scripts', { timeout: 30_000 });
  const frame = frameElement.contentFrame();
  await frame.getByRole('button', { name: 'idle' }).click({ timeout: 30_000 });
  await expect(frame.getByRole('button')).toHaveText(BLOCKED);
  // A frame without an origin reports its height by message.
  await expect.poll(async () => frameElement.evaluate((node) => node.style.height)).not.toBe('');
});
