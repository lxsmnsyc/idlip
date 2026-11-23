// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, '../fixtures/svg/raw.tsx'), 'utf8');

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

function getErrors(source: string): string[] {
  const rules: string[] = [];
  for (const item of compile(source, '/src/app.tsx').diagnostics) {
    if (item.severity === 'error') {
      rules.push(item.rule);
    }
  }
  return rules;
}

describe('raw html', () => {
  it('writes the trusted value as is on the server', async () => {
    page = await mount(SOURCE, { note: '<u>a</u> & b' });
    expect(page.get('main > div').innerHTML).toBe('<u>a</u> &amp; b');
    expect(page.get('li').innerHTML).toBe('<i>one</i>');
  });

  it('keeps the svg namespace of raw html in an svg element', async () => {
    page = await mount(SOURCE, { note: 'x' });
    expect(page.get('g circle').namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('patches the content when the value changes', async () => {
    page = await mount(SOURCE, { note: 'x' });
    page.click('button:nth-child(1)');
    await page.settled();
    expect(page.get('main > div').innerHTML).toBe('<em>new</em>');
    expect(page.get('main > div em').textContent).toBe('new');
  });

  it('writes the raw html of a row created on the client', async () => {
    page = await mount(SOURCE, { note: 'x' });
    page.click('button:nth-child(2)');
    await page.settled();
    expect(page.root.querySelectorAll('li')).toHaveLength(2);
    expect(page.get('li:nth-child(2) b').textContent).toBe('two');
  });
});

describe('raw html is rejected unless trusted', () => {
  const header =
    "import { trusted } from 'idlip';\nimport type { JSX } from 'idlip/jsx-runtime';\n";

  function wrap(view: string): string {
    return `${header}export default function A(props: { s: string }): JSX.Element {\n  return ${view};\n}\n`;
  }

  it('rejects a plain string', () => {
    expect(getErrors(wrap('<div html={props.s} />'))).toContain('html-trusted');
    expect(getErrors(wrap('<div html="<b>x</b>" />'))).toContain('html-trusted');
  });

  it('rejects a trusted that is not the one from idlip', () => {
    const source = `import type { JSX } from 'idlip/jsx-runtime';\nfunction trusted(s: string) { return s; }\nexport default function A(props: { s: string }): JSX.Element {\n  return <div html={trusted(props.s)} />;\n}\n`;
    expect(getErrors(source)).toContain('html-trusted');
  });

  it('rejects children next to html', () => {
    expect(getErrors(wrap('<div html={trusted(props.s)}>x</div>'))).toContain('html-children');
  });

  it('rejects another export of idlip imported as trusted', () => {
    const source = `import { For as trusted } from 'idlip';\nimport type { JSX } from 'idlip/jsx-runtime';\nexport default function A(props: { s: string }): JSX.Element {\n  return <div html={trusted(props.s)} />;\n}\n`;
    expect(getErrors(source)).toContain('html-trusted');
  });

  it('accepts trusted imported under another name', () => {
    const source = `import { trusted as safe } from 'idlip';\nimport type { JSX } from 'idlip/jsx-runtime';\nexport default function A(props: { s: string }): JSX.Element {\n  return <div html={safe(props.s)} />;\n}\n`;
    expect(getErrors(source)).toEqual([]);
  });

  it('rejects html on elements whose content is text', () => {
    for (const tag of ['script', 'style', 'textarea', 'title', 'noscript']) {
      expect(getErrors(wrap(`<${tag} html={trusted(props.s)} />`))).toContain('html-element');
    }
  });

  it('rejects plain on* attributes, in html and in svg', () => {
    expect(getErrors(wrap('<svg onload={props.s} />'))).toContain('attr-event');
    expect(getErrors(wrap('<img onerror="x" />'))).toContain('attr-event');
    expect(getErrors(wrap('<div on:click={() => {}} />'))).not.toContain('attr-event');
  });

  it('accepts trusted from idlip', () => {
    expect(getErrors(wrap('<div html={trusted(props.s)} />'))).toEqual([]);
  });
});
