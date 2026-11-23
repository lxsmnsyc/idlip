import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// `vite dev` of a copy of examples/counters-subs (`fixture/hot-app.ts`), which the test edits.
// Each `Counter` is a child with a subscription, and the copy counts the starts of its source.
const file = path.resolve(import.meta.dirname, '../.hot/counters-subs/src/counter.tsx');

async function readStarts(page: Page): Promise<number> {
  return Number(await page.evaluate(() => Reflect.get(globalThis, 'idlipStarts') as unknown));
}

test('a remount keeps the model of each child and starts the subscriptions again', async ({
  page,
}) => {
  const messages: string[] = [];
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (String(payload).includes('idlip:hot')) {
        messages.push(String(payload));
      }
    });
  });
  await page.goto('/');
  const outputs = page.locator('output');
  await expect(outputs).toHaveText(['0', '3', '1']);
  await expect.poll(async () => readStarts(page)).toBe(3);

  // Each child has its own model.
  await page.getByRole('button', { name: '+' }).nth(0).click();
  await page.getByRole('button', { name: '+' }).nth(0).click();
  await page.getByRole('button', { name: '+' }).nth(2).click();
  await expect(outputs).toHaveText(['2', '3', '2']);

  // The child's markup changes, so the page renders again.
  const source = readFileSync(file, 'utf8');
  expect(source).toContain('<span>{props.label}</span>');
  writeFileSync(file, source.replace('<span>{props.label}</span>', '<i>{props.label}</i>'));
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain('"kind":"remount"');
  await expect(page.locator('i')).toHaveCount(3);
  await expect(outputs).toHaveText(['2', '3', '2']);
  await expect.poll(async () => readStarts(page)).toBe(6);

  // The new page runs: a click patches the child, and a removed child leaves the others as they are.
  await page.getByRole('button', { name: '+' }).nth(1).click();
  await expect(outputs).toHaveText(['2', '4', '2']);
  await page.getByRole('button', { name: 'Remove' }).nth(0).click();
  await expect(outputs).toHaveText(['4', '2']);
});
