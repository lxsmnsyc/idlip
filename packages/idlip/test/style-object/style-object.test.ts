// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, 'subject.tsx'), 'utf8');

const ROWS = [
  { id: 'a', color: 'red' },
  { id: 'b', color: 'blue' },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

function readStyle(selector: string): string | null {
  return page!.root.querySelector(selector)!.getAttribute('style');
}

describe('style objects', () => {
  it('folds a static object to CSS text with kebab-case keys and custom properties', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    expect(readStyle('#static')).toBe('color:red;background-color:#fff;margin:0;--gap:4px');
  });

  it('drops null and false values', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    expect(readStyle('#dropped')).toBe('color:blue');
  });

  it('keeps a string style as written', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    expect(readStyle('#text')).toBe('color: green');
  });

  it('renders a dynamic object, with no [object Object]', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    expect(readStyle('#dynamic')).toBe('--size:2;font-size:2px');
    expect(page.root.innerHTML).not.toContain('[object Object]');
  });

  it('patches a dynamic object on click', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    page.click('button');
    await page.settled();
    expect(readStyle('#dynamic')).toBe('--size:3;font-size:3px;display:none');
    expect(readStyle('#static')).toBe('color:red;background-color:#fff;margin:0;--gap:4px');
  });

  it('renders and patches a style object in a row', async () => {
    page = await mount(SOURCE, { size: 2, rows: ROWS });
    expect(readStyle('li:nth-child(2)')).toBe('color:blue;margin-top:2');
    page.click('button');
    await page.settled();
    expect(readStyle('li:nth-child(2)')).toBe('color:blue;margin-top:3');
  });
});
