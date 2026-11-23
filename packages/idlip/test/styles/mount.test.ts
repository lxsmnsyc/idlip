// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

// The todo example imports a stylesheet and a CSS Module. `mount` loads no stylesheet.
const source = readFileSync(
  path.resolve(import.meta.dirname, '../../../../examples/todo/src/todo.tsx'),
  'utf8',
);
const initial = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build the runtime', done: false },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

it('ignores stylesheets and gives a CSS Module class name as its own key', async () => {
  page = await mount(source, { initial });
  expect(page.get('p').className).toBe('left');

  page.click('li:nth-child(2) input');
  await page.settled();
  expect(page.get('p').className).toBe('clear');
});
