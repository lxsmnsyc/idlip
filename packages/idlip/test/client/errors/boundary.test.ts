// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { failRegion } from '../../../src/client/errors.ts';
import type { Manifest, Page, Scope } from '../../../src/core/format.ts';

const manifest: Manifest = {
  module: '/src/child.tsx',
  events: [],
  handlers: {},
  groups: {},
  lists: {},
  fallback: { '0': 'try=0' },
};

const scope: Scope = { model: {}, props: {}, rows: [] };

function createPage(): Page {
  return {
    root: document.body,
    manifest,
    props: {},
    // oxlint-disable-next-line typescript/promise-function-async
    load: () => Promise.resolve({ render: () => '<em>caught</em>' }),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a child boundary', () => {
  it('does not match the region of the parent around the child', async () => {
    document.body.innerHTML =
      '<!--e0:0--><div><!--n:a--><span id="inner">1</span><!--/n--></div><!--/e-->';
    const node = document.querySelector('#inner')!;
    expect(await failRegion(createPage(), node, new Error('x'), scope)).toBe(false);
    expect(document.body.innerHTML).toContain('<span id="inner">');
  });

  it('skips the boundary of a child that comes before the node', async () => {
    document.body.innerHTML =
      '<!--e0:0--><!--n:a--><b>1</b><!--/n--><span id="after">2</span><!--/e-->';
    const node = document.querySelector('#after')!;
    expect(await failRegion(createPage(), node, new Error('x'), scope)).toBe(true);
    expect(document.body.innerHTML).toBe('<!--e0:1--><em>caught</em><!--/e-->');
  });

  it('matches a region inside the child', async () => {
    document.body.innerHTML = '<!--n:a--><!--e0:0--><span id="inner">1</span><!--/e--><!--/n-->';
    const node = document.querySelector('#inner')!;
    expect(await failRegion(createPage(), node, new Error('x'), scope)).toBe(true);
    expect(document.body.innerHTML).toBe('<!--n:a--><!--e0:1--><em>caught</em><!--/e--><!--/n-->');
  });
});
