// @vitest-environment happy-dom
// oxlint-disable no-script-url
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, 'gaps.tsx'), 'utf8');
const EVIL = 'javascript:alert(1)';
const HTML_DATA = 'data:text/html,<script>alert(1)</script>';
const IMAGE_DATA = 'data:image/png;base64,AAAA';
const ANIMATIONS: [string, string][] = [
  ['#to', 'to'],
  ['#from', 'from'],
  ['#by', 'by'],
  ['#set', 'to'],
  ['#values', 'values'],
  ['#dyn', 'to'],
];
const EMBEDS: [string, string][] = [
  ['#iframe', 'src'],
  ['#object', 'data'],
  ['#embed', 'src'],
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  vi.restoreAllMocks();
});

const HEADER = "import { trusted } from 'idlip';\nimport type { JSX } from 'idlip/jsx-runtime';\n";

function wrap(view: string): string {
  return `${HEADER}export default function A(props: { s: string }): JSX.Element {\n  return ${view};\n}\n`;
}

function getErrors(view: string): string[] {
  const rules: string[] = [];
  for (const item of compile(wrap(view), '/src/app.tsx').diagnostics) {
    if (item.severity === 'error') {
      rules.push(item.rule);
    }
  }
  return rules;
}

describe('SVG animation targets', () => {
  it('drops a javascript: URL in the server render', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: EVIL, name: 'href' });
    for (const [selector, name] of ANIMATIONS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
  });

  it('drops a javascript: URL after a client patch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: '/ok', name: 'href' });
    page.click('button:nth-child(1)');
    await page.settled();
    for (const [selector, name] of ANIMATIONS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
  });

  it('keeps the value of an attribute that is not a URL', async () => {
    page = await mount(SOURCE, { url: 'javascript:1', name: 'href' });
    expect(page.get('#plain').getAttribute('to')).toBe('javascript:1');
  });
});

describe('embedded documents', () => {
  it('drops a data: document and keeps a data: image', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: HTML_DATA, name: 'href' });
    for (const [selector, name] of EMBEDS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
    page.stop();
    page = await mount(SOURCE, { url: IMAGE_DATA, name: 'href' });
    for (const [selector, name] of EMBEDS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBe(IMAGE_DATA);
    }
  });

  it('drops a data: document after a client patch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(SOURCE, { url: '/ok', name: 'href' });
    page.click('button:nth-child(2)');
    await page.settled();
    for (const [selector, name] of EMBEDS) {
      expect(page.get(selector).getAttribute(name), `${selector} ${name}`).toBeNull();
    }
    page.click('button:nth-child(3)');
    await page.settled();
    expect(page.get('#iframe').getAttribute('src')).toBe(IMAGE_DATA);
  });

  it('keeps a data: URL on an img', async () => {
    page = await mount(SOURCE, { url: HTML_DATA, name: 'href' });
    expect(page.get('#img').getAttribute('src')).toBe(HTML_DATA);
  });
});

describe('srcdoc', () => {
  it('is an error unless the value is trusted', () => {
    expect(getErrors('<iframe srcdoc={props.s} />')).toContain('srcdoc-trusted');
    expect(getErrors('<iframe srcdoc={`<p>${props.s}</p>`} />')).toContain('srcdoc-trusted');
  });

  it('accepts trusted(...) and a literal', () => {
    expect(getErrors('<iframe srcdoc={trusted(props.s)} />')).toEqual([]);
    expect(getErrors('<iframe srcdoc="<p>x</p>" />')).toEqual([]);
  });

  it('writes the trusted value, escaped as an attribute', async () => {
    page = await mount(wrap('<iframe id="f" srcdoc={trusted(props.s)} />'), {
      s: '<p a="1">x</p>',
    });
    expect(page.get('#f').getAttribute('srcdoc')).toBe('<p a="1">x</p>');
  });
});
