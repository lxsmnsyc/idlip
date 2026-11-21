import type { Page } from '@playwright/test';
import { expect, settle, test } from './support.ts';

const OLD_BUILD = 'old00000';

interface Deploy {
  /** Page loads so far. */
  pages: number;
  /** The old page comes back on every load, as a cache that keeps it would. */
  keepOld: boolean;
}

/**
 * Serves the first page load as an older build rendered it, and removes the chunk files of that
 * build: the page names chunks that the new deploy no longer has. A `fetch` of the page, which
 * the loader uses to ask for the server's build, gets the page of the new build.
 */
async function serveOldBuild(page: Page, deploy: Deploy): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/' && request.resourceType() === 'document') {
      deploy.pages++;
      if (deploy.keepOld || deploy.pages === 1) {
        const response = await route.fetch();
        const body = (await response.text()).replace(/i-build="[^"]*"/, `i-build="${OLD_BUILD}"`);
        await route.fulfill({ response, body });
        return;
      }
    }
    const gone = deploy.keepOld || deploy.pages <= 1;
    if (gone && /\/assets\/todo\.[^/]*\.js$/.test(url.pathname)) {
      await route.fulfill({ status: 404, body: 'gone' });
      return;
    }
    await route.continue();
  });
}

test.describe('a cached page meets a newer build', () => {
  test('reloads onto the new build and the click works', async ({ page, problems }) => {
    const deploy: Deploy = { pages: 0, keepOld: false };
    await serveOldBuild(page, deploy);
    await page.goto('/');
    expect(await page.locator('script[i-build]').getAttribute('i-build')).toBe(OLD_BUILD);

    // The chunk of the click is gone. The reload gets the real page, and its chunks load.
    const reloaded = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
    await page.getByRole('checkbox').nth(1).click();
    await reloaded;

    const build = await page.locator('script[i-build]').getAttribute('i-build');
    expect(build).toMatch(/^[\da-f]{8}$/);
    expect(build).not.toBe(OLD_BUILD);
    expect(deploy.pages).toBe(2);
    await page.getByRole('checkbox').nth(1).click();
    await settle(page);
    await expect(page.locator('p')).toHaveText('0 left');
    // The failed chunk requests were the only problems.
    expect(problems.length).toBeGreaterThan(0);
    problems.length = 0;
  });

  test('does not reload in a loop when the old page keeps coming back', async ({
    page,
    problems,
  }) => {
    const deploy: Deploy = { pages: 0, keepOld: true };
    await serveOldBuild(page, deploy);
    await page.goto('/');
    const reloaded = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
    await page.getByRole('checkbox').nth(1).click();
    await reloaded;
    expect(deploy.pages).toBe(2);

    // The reloaded page is the old build again and a chunk fails again: the tab stays.
    await page.getByRole('checkbox').nth(1).click();
    await page.waitForTimeout(500);
    expect(deploy.pages).toBe(2);
    expect(await page.locator('script[i-build]').getAttribute('i-build')).toBe(OLD_BUILD);
    problems.length = 0;
  });
});
