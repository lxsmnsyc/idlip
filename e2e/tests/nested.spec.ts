import type { Locator, Page } from '@playwright/test';
import { collectRequests, expect, readMain, serializeNode, test } from './support.ts';

interface Item {
  readonly id: string;
  readonly label: string;
  readonly start: number;
}

const initial: readonly Item[] = [
  { id: 'a1', label: 'Apples', start: 0 },
  { id: 'a2', label: 'Pears <green>', start: 3 },
  { id: 'a3', label: 'Plums', start: 1 },
];

/**
 * Renders the page again on the server for these items and returns its `<main>` markup, parsed
 * and serialized by a browser with scripts off. A counter's state is its `start` prop there.
 */
async function renderFresh(page: Page, items: readonly Item[]): Promise<string> {
  const props = encodeURIComponent(JSON.stringify({ items }));
  const html = await (await page.request.get(`/?props=${props}`)).text();
  const context = await page.context().browser()?.newContext({ javaScriptEnabled: false });
  if (context === undefined) {
    throw new Error('The browser is closed');
  }
  const other = await context.newPage();
  await other.setContent(html);
  const markup = await other.locator('main').evaluate(serializeNode);
  await context.close();
  return markup;
}

function getRow(page: Page, index: number): Locator {
  return page.locator('main > div').nth(index);
}

test('the first child click loads only that child handler and binding chunks', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const chunks = await collectRequests(page, async () => {
    await getRow(page, 0).getByRole('button', { name: '+' }).click();
    await expect(getRow(page, 0).locator('output')).toHaveText('1');
  });
  expect(chunks.toSorted()).toEqual(['binding=count', 'handler=increment']);
  expect(await readMain(page)).toBe(
    await renderFresh(page, [{ ...initial[0], start: 1 }, initial[1], initial[2]]),
  );
});

test('another child and the same handler load nothing more', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await getRow(page, 0).getByRole('button', { name: '+' }).click();
  await expect(getRow(page, 0).locator('output')).toHaveText('1');
  const chunks = await collectRequests(page, async () => {
    await getRow(page, 1).getByRole('button', { name: '+' }).click();
    await expect(getRow(page, 1).locator('output')).toHaveText('4');
  });
  expect(chunks).toEqual([]);
  // Each child keeps its own count.
  await expect(getRow(page, 0).locator('output')).toHaveText('1');
  await expect(getRow(page, 2).locator('output')).toHaveText('1');
  expect(await readMain(page)).toBe(
    await renderFresh(page, [{ ...initial[0], start: 1 }, { ...initial[1], start: 4 }, initial[2]]),
  );
});

test('the DOM after each click and remove equals a fresh server render', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await getRow(page, 2).getByRole('button', { name: '+' }).click();
  await expect(getRow(page, 2).locator('output')).toHaveText('2');
  expect(await readMain(page)).toBe(
    await renderFresh(page, [initial[0], initial[1], { ...initial[2], start: 2 }]),
  );

  // The remove button of the middle child reaches the parent's `remove`.
  await getRow(page, 1).getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('p')).toHaveText('2 counters');
  await expect(page.locator('main > div')).toHaveCount(2);
  expect(await readMain(page)).toBe(
    await renderFresh(page, [initial[0], { ...initial[2], start: 2 }]),
  );

  // The child after the removed one still counts, and the one before it is unchanged.
  await getRow(page, 1).getByRole('button', { name: '+' }).click();
  await expect(getRow(page, 1).locator('output')).toHaveText('3');
  await getRow(page, 0).getByRole('button', { name: '+' }).click();
  await expect(getRow(page, 0).locator('output')).toHaveText('1');
  expect(await readMain(page)).toBe(
    await renderFresh(page, [
      { ...initial[0], start: 1 },
      { ...initial[2], start: 3 },
    ]),
  );

  await getRow(page, 0).getByRole('button', { name: 'Remove' }).click();
  await getRow(page, 0).getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('p')).toHaveText('0 counters');
  expect(await readMain(page)).toBe(await renderFresh(page, []));
});
