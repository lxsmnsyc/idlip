import { runInThisContext } from 'node:vm';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { getLocalName } from '../../src/compiler/view/codegen/text.ts';
import * as blocks from '../../src/client/patch/blocks.ts';
import { findNode } from '../../src/client/patch/nodes.ts';
import { parseHtml } from '../../src/client/patch/dom.ts';
import {
  HELPER_NAMES,
  attr$,
  on$,
  printHelpers,
  setAttr$,
  setBranch$,
  setOn$,
  setText$,
  text$,
} from '../../src/core/helpers.ts';

type Callable = (...args: never[]) => unknown;

const PUBLIC = ['text', 'attr', 'on', 'setText', 'setAttr', 'setOn', 'setBranch'];
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

/** Evaluates a copy in a scope that holds only the loader's exports, as a chunk would. */
function getCopy(name: string): Callable {
  const printed = printHelpers([name]);
  const params: string[] = [];
  const args: unknown[] = [];
  for (const imported of printed.client) {
    params.push(`${imported}$`);
    args.push(LOADER[imported]);
  }
  const body = `${printed.code.join('\n')}\nreturn ${name}$;`;
  const factory: unknown = runInThisContext(`(function (${params.join(', ')}) {\n${body}\n})`);
  if (!isCallable(factory)) {
    throw new TypeError('The copy has no factory');
  }
  const copy: unknown = call(factory, ...args);
  if (!isCallable(copy)) {
    throw new TypeError(`${name} is not a function`);
  }
  return copy;
}

function find(root: unknown, name: string): unknown {
  return call(findNode, root, name);
}

describe('chunk helpers', () => {
  it('prints dependencies once, before the function that calls them', () => {
    const { code } = printHelpers(['text', 'attr', 'setAttr']);
    const names: string[] = [];
    for (const item of code) {
      names.push(/^function (\w+\$)/.exec(item)?.[1] ?? '');
    }
    expect(new Set(names).size).toBe(names.length);
    expect(names.indexOf('getText$')).toBeLessThan(names.indexOf('text$'));
    expect(names.indexOf('joinClass$')).toBeLessThan(names.indexOf('attr$'));
  });

  it('keeps comments and module references out of a copy', () => {
    for (const name of PUBLIC) {
      for (const item of printHelpers([name]).code) {
        expect(item).not.toMatch(/\/\/|\/\*|__vite|__import|\bimport\b/);
      }
    }
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
    call(getCopy('setBranch'), root.firstChild, 1, () => '<em>b</em>');
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
    call(swap, row, 1, () => 'y');
    expect(find(root, 't9')).toBeUndefined();
    // A top-level block: the index is rebuilt and sees the new marker.
    call(swap, root.childNodes[1], 1, () => 'b');
    expect(find(root, 't9')).toBeDefined();
    expect(find(root, 't1')).toBe(marker);
  });

  it('reserves every name a copy defines', () => {
    for (const name of HELPER_NAMES) {
      expect(getLocalName(name), name).toBe(`${name}$`);
    }
  });

  it('rejects a helper that does not exist', () => {
    expect(() => printHelpers(['nope'])).toThrow('Unknown helper nope$');
  });
});
