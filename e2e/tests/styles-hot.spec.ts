import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './support.ts';

// `vite dev` of a copy of examples/todo (`fixture/hot-app.ts`): an edit of a stylesheet shows in
// the open page without a reload. The `hot` project serves the copy with Nitro, and
// `hot-fallback` with the dev middleware of the plugin.
test('an edit of a stylesheet applies without a reload', async ({ page }, testInfo) => {
  const copy = testInfo.project.name === 'hot-fallback' ? 'todo-fallback' : 'todo';
  const file = path.resolve(import.meta.dirname, `../.hot/${copy}/src/todo.css`);
  const original = readFileSync(file, 'utf8');
  await page.goto('/');
  const input = page.locator('form input');
  await expect(input).toHaveCSS('flex-grow', '1');
  await page.evaluate(() => {
    Reflect.set(window, 'idlipSurvives', true);
  });
  try {
    writeFileSync(file, original.replace('flex: 1;', 'flex: 3;'));
    await expect(input).toHaveCSS('flex-grow', '3');
    // The same document: a reload would have dropped the flag.
    expect(await page.evaluate(() => Reflect.has(window, 'idlipSurvives'))).toBe(true);
  } finally {
    writeFileSync(file, original);
  }
});
