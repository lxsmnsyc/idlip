// @vitest-environment happy-dom
// oxlint-disable no-script-url
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeUrl$ } from '../../src/core/helpers.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, 'urls.tsx'), 'utf8');
const EVIL = 'javascript:alert(1)';
const TARGETS: [string, string][] = [
  ['#html', 'href'],
  ['form', 'action'],
  ['#fa', 'formaction'],
  ['#svg', 'href'],
  ['#xlink', 'xlink:href'],
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  vi.restoreAllMocks();
});

describe('URL attributes', () => {
  it('drops a javascript: URL from the model in the server render', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: EVIL });
    for (const [selector, name] of TARGETS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
  });

  it('drops a javascript: URL from the model after a client patch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: '/ok' });
    page.click('button:nth-child(1)');
    await page.settled();
    for (const [selector, name] of TARGETS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
    page.click('button:nth-child(2)');
    await page.settled();
    expect(page.get('#html').getAttribute('href')).toBe('/ok');
    expect(page.get('#xlink').getAttribute('xlink:href')).toBe('/ok');
  });
});

describe('the URL check', () => {
  it('drops scheme variants and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = [
      'JaVaScRiPt:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      '\u0001javascript:alert(1)',
      'java\nscr\ript:alert(1)',
      'vbscript:msgbox(1)',
      'VBScript:x',
    ];
    for (const url of bad) {
      expect(safeUrl$(url, 'href'), url).toBeUndefined();
    }
    expect(safeUrl$({ 'javascript:alert(1)': true }, 'href')).toBeUndefined();
    expect(safeUrl$(['javascript:alert(1)'], 'href')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(bad.length + 2);
  });

  it('keeps ordinary values', () => {
    for (const url of ['/a', 'https://x.test/?q=javascript:1', 'mailto:a@b.c', '#javascript:', 5]) {
      expect(safeUrl$(url, 'href')).toBe(url);
    }
    expect(safeUrl$(undefined, 'href')).toBeUndefined();
    expect(safeUrl$(false, 'href')).toBe(false);
  });

  it('keeps a static literal written in source', async () => {
    page = await mount(SOURCE, { url: '/ok' });
    expect(page.get('#static').getAttribute('href')).toBe('javascript:void(0)');
  });
});
