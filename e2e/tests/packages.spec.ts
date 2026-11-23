import { expect, test } from './support.ts';

// The package-components example renders `Counter` and `Badge` from the `@idlip-example/ui`
// package, a workspace package that publishes its `.tsx` source. The `packages` project reads the
// production build served by Nitro, and `packages-dev` and `packages-fallback` read `vite dev`
// with and without Nitro.

/** A built chunk file of the package's counter, or the dev URL of its source file. */
const COUNTER_HANDLER =
  /(?:idlip-example-ui\.counter\.handler\.add\.[\w-]+\.js$|\/counter\.tsx\?(?:import&)?idlip-handler=add&lang\.js$)/;

test('a package component renders with its plain stylesheet and CSS Module', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.ui-counter');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveCSS('display', 'flex');
  await expect(rows.nth(0).locator('output')).toHaveText('0');
  await expect(rows.nth(0).locator('output')).toHaveCSS('color', 'rgb(10, 20, 30)');
});

test('a click runs the handler of the package component from its own chunk', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  const rows = page.locator('.ui-counter');
  await rows.nth(1).getByRole('button', { name: '+' }).click();
  await expect(rows.nth(1).locator('output')).toHaveText('3');
  expect(urls.some((url) => COUNTER_HANDLER.test(url))).toBe(true);
  // The class name comes from the CSS Module in the package, and the other row keeps its state.
  await expect(rows.nth(1).locator('output')).toHaveCSS('color', 'rgb(0, 128, 0)');
  await expect(rows.nth(0).locator('output')).toHaveText('0');
});

test('a package component works on its own and inside the list across a clear', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const badge = page.locator('.ui-badge');
  await expect(badge).toHaveText('from a package');
  await badge.click();
  await expect(badge).toHaveText('from a package (seen)');

  // The parent's handler removes the rows, and the badge keeps its state.
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.ui-counter')).toHaveCount(0);
  await expect(badge).toHaveText('from a package (seen)');
});
