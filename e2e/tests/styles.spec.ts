import { expect, test } from './support.ts';

// The todo example imports `todo.css` (a plain stylesheet) and `todo.module.css` (a CSS Module).
// The `chromium` project reads the production build served by Nitro, and the `styles` and
// `styles-fallback` projects read `vite dev` with and without Nitro.

test('the page links its stylesheets in the head, so the first paint is styled', async ({
  page,
}) => {
  // The document the server sends has the links, so the browser holds the first paint for them.
  const response = await page.request.get('/', { headers: { accept: 'text/html' } });
  const html = await response.text();
  const head = html.slice(0, html.indexOf('</head>'));
  expect([...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].length).toBeGreaterThan(0);
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('margin-left', /px$/);
});

test('a plain stylesheet applies', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(34, 40, 49)');
  await expect(page.locator('body')).toHaveCSS('max-width', '448px');
  await expect(page.locator('form')).toHaveCSS('display', 'flex');
  // The first todo is done.
  await expect(page.locator('li').nth(0)).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.locator('li').nth(1)).toHaveCSS('text-decoration-line', 'none');
});

test('a CSS Module applies, and the browser gets the class names the server wrote', async ({
  page,
}) => {
  await page.goto('/');
  const count = page.locator('p');
  await expect(count).toHaveClass(/^_left_/);
  await expect(count).toHaveCSS('color', 'rgb(10, 20, 30)');
  await expect(count).toHaveCSS('font-weight', '400');

  // A click runs the client chunk, which sets a class name of the same module.
  await page.getByRole('checkbox').nth(1).click();
  await expect(count).toHaveText('0 left');
  await expect(count).toHaveClass(/^_clear_/);
  await expect(count).toHaveCSS('color', 'rgb(0, 128, 0)');
  await expect(count).toHaveCSS('font-weight', '600');
  await page.getByRole('checkbox').nth(1).click();
  await expect(count).toHaveClass(/^_left_/);
  await expect(count).toHaveCSS('color', 'rgb(10, 20, 30)');
});
