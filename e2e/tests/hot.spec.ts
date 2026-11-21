import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// `vite dev` of a copy of examples/todo (`fixture/hot-app.ts`), which the test edits.
const file = path.resolve(import.meta.dirname, '../.hot/todo/src/todo.idlip.tsx');

function edit(from: string, to: string): void {
  const source = readFileSync(file, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`The todo source has no ${from}`);
  }
  writeFileSync(file, source.replace(from, to));
}

test('an edit swaps a handler or remounts the markup and keeps the model', async ({ page }) => {
  const messages: string[] = [];
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (String(payload).includes('idlip:hot')) {
        messages.push(String(payload));
      }
    });
  });
  await page.goto('/');
  await expect(page.locator('p')).toHaveText('1 left');

  // The model changes before the edits: the second todo is done, and a third is added.
  await page.getByRole('checkbox').nth(1).click();
  await expect(page.locator('p')).toHaveText('0 left');

  // A handler body: the chunk swaps, and the next event runs the new code on the same model.
  edit('text: draft,', 'text: draft + "!",');
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain('"kind":"swap"');
  await page.getByRole('textbox').fill('new');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('li').nth(2)).toHaveText('new!');
  await expect(page.locator('p')).toHaveText('1 left');

  // The markup: the page renders again on the server and keeps the model.
  edit('{left} left', '{left} remaining');
  await expect.poll(() => messages.length).toBe(2);
  expect(messages[1]).toContain('"kind":"remount"');
  await expect(page.locator('p')).toHaveText('1 remaining');
  await expect(page.locator('li')).toHaveCount(3);
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  await expect(page.locator('li').nth(2)).toHaveText('new!');

  // The page still works after the remount, with the swapped handler.
  await page.getByRole('checkbox').nth(2).click();
  await expect(page.locator('p')).toHaveText('0 remaining');
});
