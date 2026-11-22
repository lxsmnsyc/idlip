import { Window } from 'happy-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { getLocalName } from '../../src/compiler/view/codegen/text.ts';
import * as blocks from '../../src/client/patch/blocks.ts';
import { findNode } from '../../src/client/patch/nodes.ts';
import { parseHtml } from '../../src/client/patch/dom.ts';
import { importHelpers } from '../../src/testing/modules.ts';
import {
  HELPER_NAMES,
  attr$,
  on$,
  printHelpersModule,
  setAttr$,
  setBranch$,
  setOn$,
  setText$,
  text$,
} from '../../src/core/helpers.ts';

type Callable = (...args: never[]) => unknown;

const SOURCES: Record<string, Callable> = {
  text: text$,
  attr: attr$,
  on: on$,
  setText: setText$,
  setAttr: setAttr$,
  setOn: setOn$,
  setBranch: setBranch$,
};
const LOADER: Record<string, unknown> = {
  addBlock: blocks.addBlock,
  findInnerBlocks: blocks.findInnerBlocks,
  parseHtml,
  removeBlock: blocks.removeBlock,
};

function isCallable(value: unknown): value is Callable {
  return typeof value === 'function';
}

function call(fn: Callable, ...args: unknown[]): unknown {
  return Reflect.apply(fn, undefined, args);
}

let copies: Record<string, unknown> = {};

/** Returns a helper of the `idlip/helpers` module, which reads only the loader's exports. */
function getCopy(name: string): Callable {
  const copy = copies[`${name}$`];
  if (!isCallable(copy)) {
    throw new TypeError(`${name} is not a function`);
  }
  return copy;
}

/** A branch render as a chunk passes it: a fragment of the document, made here from HTML. */
function toNodes(html: string): (branch: number, doc: Document) => Node {
  return (_branch, doc) => {
    const fragment = doc.createDocumentFragment();
    fragment.append(...parseHtml(doc, html));
    return fragment;
  };
}

function find(root: unknown, name: string): unknown {
  return call(findNode, root, name);
}

describe('chunk helpers', () => {
  beforeAll(async () => {
    Reflect.set(globalThis, '$idlipHelpersTest', { client: LOADER });
    copies = await importHelpers('$idlipHelpersTest');
  });

  it('defines and exports each helper once', () => {
    const names: string[] = [];
    for (const match of printHelpersModule().matchAll(/^function (\w+\$)/gm)) {
      names.push(match[1]);
    }
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(copies).toSorted()).toEqual(names.toSorted());
  });

  it('imports only the loader, and keeps comments and module references out', () => {
    const [imports, ...rest] = printHelpersModule().split('\n\n');
    expect(imports).toBe(
      "import { addBlock as addBlock$, findInnerBlocks as findInnerBlocks$, parseHtml as parseHtml$, removeBlock as removeBlock$ } from 'idlip/client';",
    );
    expect(rest.join('\n\n')).not.toMatch(/\/\/|\/\*|__vite|__import|\bimport\b/);
  });

  it('copies run on their own and equal the source', () => {
    for (const value of [null, undefined, true, false, 0, 'a<b&"c"', { a: 1, b: 0 }]) {
      expect(call(getCopy('text'), value)).toBe(text$(value));
      expect(call(getCopy('attr'), 'class', value)).toBe(attr$('class', value));
      expect(call(getCopy('attr'), 'title', value)).toBe(attr$('title', value));
    }
    const message: ['go', unknown[]] = ['go', ["it's", '&']];
    expect(call(getCopy('on'), 'click', message)).toBe(on$('click', message));
  });

  it('copies of setAttr and setOn act like the source', () => {
    const { document } = new Window();
    const copy = document.createElement('input');
    const source = document.createElement('input');
    for (const [name, value] of [
      ['value', 12],
      ['checked', 1],
      ['class', { a: true, b: false }],
      ['title', null],
      ['hidden', true],
    ] as const) {
      call(getCopy('setAttr'), copy, name, value);
      call(SOURCES.setAttr, source, name, value);
    }
    call(getCopy('setOn'), copy, 'click', ['a', []]);
    call(SOURCES.setOn, source, 'click', ['a', []]);
    expect(copy.outerHTML).toBe(source.outerHTML);
    expect(copy.outerHTML).toContain('class="a"');
  });

  it('copies of setText act like the source', () => {
    const { document } = new Window();
    const pages: string[] = [];
    for (const set of [getCopy('setText'), SOURCES.setText]) {
      const root = document.createElement('div');
      root.innerHTML = '<p><!--t0--><!--/t--></p>';
      const start = root.firstChild?.firstChild;
      call(set, start, 'a');
      call(set, start, 'b');
      pages.push(root.innerHTML);
    }
    expect(pages[0]).toBe(pages[1]);
    expect(pages[0]).toContain('<!--t0-->b<!--/t-->');
  });

  it('copies of setBranch swap a block and call the hooks', () => {
    const { document } = new Window();
    const events: string[] = [];
    blocks.onBlock(
      (start) => {
        events.push(`add ${start.data}`);
      },
      (start) => {
        events.push(`remove ${start.data}`);
      },
    );
    const root = document.createElement('div');
    root.innerHTML = '<!--c0:0--><p>a</p><!--c1:0-->x<!--/c--><!--/c-->';
    call(getCopy('setBranch'), root.firstChild, 1, toNodes('<em>b</em>'));
    expect(root.innerHTML).toBe('<!--c0:1--><em>b</em><!--/c-->');
    expect(events).toEqual(['remove c1:0', 'remove c0:0', 'add c0:1']);
  });

  it('forgets found nodes after a top-level swap, but not after a swap in a row', () => {
    const { document } = new Window();
    const root = document.createElement('div');
    root.innerHTML =
      '<!--c0:0--><p>a</p><!--/c--><!--t1--><!--/t-->' +
      '<!--l2--><!--i--><!--c3:0-->x<!--/c--><!--/i--><!--/l-->';
    const marker = find(root, 't1');
    const swap = getCopy('setBranch');
    // A block in a row: the index is kept.
    root.insertBefore(document.createComment('t9'), root.firstChild);
    const row = root.childNodes[4]?.nextSibling;
    call(swap, row, 1, toNodes('y'));
    expect(find(root, 't9')).toBeUndefined();
    // A top-level block: the index is rebuilt and sees the new marker.
    call(swap, root.childNodes[1], 1, toNodes('b'));
    expect(find(root, 't9')).toBeDefined();
    expect(find(root, 't1')).toBe(marker);
  });

  it('reserves every name a copy defines', () => {
    for (const name of HELPER_NAMES) {
      expect(getLocalName(name), name).toBe(`${name}$`);
    }
  });
});
