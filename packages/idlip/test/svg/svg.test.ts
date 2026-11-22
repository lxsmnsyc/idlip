// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { parseHtml } from '../../src/client/patch/dom.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, '../fixtures/svg/svg.tsx'), 'utf8');
const SVG = 'http://www.w3.org/2000/svg';
const HTML = 'http://www.w3.org/1999/xhtml';

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

// happy-dom does not parse MathML: it puts the content of <math> in the HTML namespace. The
// MathML cases check what the compiler and the parser hand over, and a real browser run (the
// outcome of `svg-and-html`) checks the namespace itself.
describe('svg namespaces', () => {
  it('renders the server markup in the svg namespace', async () => {
    page = await mount(SOURCE, { first: '2' });
    expect(page.get('circle').namespaceURI).toBe(SVG);
  });

  it('creates a list row in svg with the svg namespace', async () => {
    page = await mount(SOURCE, { first: '2' });
    page.click('button:nth-child(1)');
    await page.settled();
    const circles = page.root.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    expect(circles[1].namespaceURI).toBe(SVG);
    expect(circles[1].getAttribute('r')).toBe('4');
  });

  it('creates a branch in svg with the svg namespace, and html in foreignObject', async () => {
    page = await mount(SOURCE, { first: '2' });
    page.click('button:nth-child(2)');
    await page.settled();
    expect(page.get('rect').namespaceURI).toBe(SVG);
    expect(page.get('foreignObject span').namespaceURI).toBe(HTML);
  });
});

describe('a <Try> catch view', () => {
  it('exports the svg namespace of its chunk inside svg, and none in html', () => {
    const inSvg = readFileSync(join(import.meta.dirname, '../fixtures/svg/try.tsx'), 'utf8');
    const inHtml = inSvg.replace('<svg>', '<div>').replace('</svg>', '</div>');
    const find = (source: string): string => {
      const chunks = compile(source, '/src/try.tsx').client;
      return chunks.find((chunk) => chunk.chunk.startsWith('try='))?.code ?? '';
    };
    expect(find(inSvg)).toContain("export const namespace = 'svg';");
    expect(find(inHtml)).not.toContain('namespace');
  });
});

describe('mathml namespaces', () => {
  it('exports the namespace of a list inside math, and of one inside svg', () => {
    const result = compile(SOURCE, '/src/shapes.tsx');
    const lists = result.client.filter((chunk) => chunk.chunk.startsWith('list='));
    const namespaces: string[] = [];
    for (const chunk of lists) {
      namespaces.push(/export const namespace = '(\w+)'/.exec(chunk.code)?.[1] ?? 'html');
    }
    expect(namespaces.toSorted()).toEqual(['mathml', 'svg']);
  });

  it('parses markup inside a math wrapper, and an svg one inside an svg wrapper', () => {
    const sources: string[] = [];
    const doc = {
      createElement: () => ({
        content: { firstChild: null },
        get innerHTML() {
          return sources.at(-1) ?? '';
        },
        set innerHTML(value: string) {
          sources.push(value);
        },
      }),
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    parseHtml(doc as unknown as Document, '<mi>x</mi>', 'mathml');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    parseHtml(doc as unknown as Document, '<circle/>', 'svg');
    expect(sources).toEqual(['<math><mi>x</mi></math>', '<svg><circle/></svg>']);
  });
});
