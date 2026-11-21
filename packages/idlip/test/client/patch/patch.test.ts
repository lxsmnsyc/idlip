// A loader returns a promise without awaiting anything.
// oxlint-disable typescript/promise-function-async
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it, vi } from 'vitest';
import { onBlock } from '../../../src/client/patch/blocks.ts';
import { setBranch } from '../../../src/client/patch/dom.ts';
import { findNode } from '../../../src/client/patch/nodes.ts';
import { createPatch } from '../../../src/client/patch/patch.ts';
import type { Manifest, Model, Page, Patch, PatchList } from '../../../src/core/format.ts';
import manifestJson from '../../fixtures/todo/expected/manifest.json' with { type: 'json' };

vi.mock('idlip/client', async () => import('../../../src/client/patch/dom.ts'));

const FIXTURE = join(import.meta.dirname, '../../fixtures/todo/expected');
const MODULE = '/src/todo.idlip.tsx';

const todos = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];
const model = { draft: '', todos, next: 3 };

type Load = (module: string, chunk: string) => Promise<unknown>;

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && 'querySelector' in value;
}

function isComment(value: unknown): value is Comment {
  return typeof value === 'object' && value !== null && 'data' in value;
}

function createPage(html: string, manifest: Manifest, load: Load): Page & { root: Element } {
  const { body } = new Window().document;
  body.innerHTML = html;
  if (!isElement(body)) {
    throw new TypeError('The window has no body');
  }
  return { root: body, manifest, props: {}, load };
}

function createManifest(groups: Manifest['groups']): Manifest {
  return { module: MODULE, events: [], handlers: {}, groups, lists: {} };
}

function setup(): {
  page: Page & { root: Element };
  loads: string[];
  patchList: ReturnType<typeof vi.fn<PatchList>>;
  patch: Patch;
} {
  const loads: string[] = [];
  const html = readFileSync(join(FIXTURE, 'page.html'), 'utf8');
  const manifest: Manifest = manifestJson;
  const page = createPage(html, manifest, (_module, chunk) => {
    loads.push(chunk);
    const file = chunk.replaceAll('=', '.').replaceAll('*', '_');
    return import(/* @vite-ignore */ join(FIXTURE, 'client', `${file}.js`));
  });
  const patchList = vi.fn<PatchList>(() => Promise.resolve());
  return { page, loads, patchList, patch: createPatch(patchList) };
}

describe('patch', () => {
  it('loads only the group that reads draft', async () => {
    const { page, loads, patchList, patch } = setup();
    await patch(page, model, { ...model, draft: 'milk' });
    expect(loads).toEqual(['binding=draft']);
    expect(page.root.querySelector<HTMLInputElement>('input:not([type])')?.value).toBe('milk');
    expect(page.root.querySelector('button')?.hasAttribute('disabled')).toBe(false);
    expect(patchList).not.toHaveBeenCalled();
  });

  it('loads nothing when no path changed', async () => {
    const { page, loads, patch } = setup();
    await patch(page, model, { ...model });
    expect(loads).toEqual([]);
  });

  it('loads one chunk for a toggle and patches the list once', async () => {
    const { page, loads, patchList, patch } = setup();
    const toggled = [todos[0], { ...todos[1], done: true }];
    await patch(page, model, { ...model, todos: toggled });
    // The chunk of `todos.*.done` covers `todos`, so `t2` and `l3` come with it.
    expect(loads).toEqual(['binding=todos.*.done']);
    expect(patchList).toHaveBeenCalledTimes(1);
    const [start, before, after, context] = patchList.mock.calls[0];
    expect(start.data).toBe('l3');
    expect(before).toBe(todos);
    expect(after).toBe(toggled);
    expect(context.list).toBe(page.manifest.lists['3']);
    expect([...context.bindings.keys()]).toEqual(['a4', 'a5']);
    expect(page.root.querySelector('p')?.textContent).toBe('0 left');
  });

  it('patches a list for a row binding when only outside state changed', async () => {
    const manifest: Manifest = {
      ...createManifest({
        selected: { paths: ['selected'], chunk: 'binding=selected', bindings: ['a2'], covers: [] },
      }),
      lists: { '1': { key: 'id', path: 'todos', chunk: 'list=1', bindings: ['a2'] } },
    };
    const a2 = vi.fn();
    const l1 = (scope: { model: Model }): unknown => scope.model.todos;
    const loads: string[] = [];
    const html = '<!--l1--><!--i--><li i-a="2"></li><!--/i--><!--/l-->';
    const page = createPage(html, manifest, (_module, chunk) => {
      loads.push(chunk);
      return Promise.resolve({ a2, l1 });
    });
    const patchList = vi.fn<PatchList>(() => Promise.resolve());
    const rows = [{ id: 'a' }, { id: 'b' }];
    await createPatch(patchList)(
      page,
      { selected: 'a', todos: rows },
      { selected: 'b', todos: rows },
    );
    expect(loads).toEqual(['binding=selected']);
    expect(patchList).toHaveBeenCalledTimes(1);
    const [start, before, after, context] = patchList.mock.calls[0];
    expect(start.data).toBe('l1');
    expect(before).toBe(rows);
    expect(after).toBe(rows);
    expect(context.bindings.get('a2')).toBe(a2);
    // The list's own bindings never run outside rows.
    expect(a2).not.toHaveBeenCalled();
  });

  it('runs a binding once when several chunks hold it', async () => {
    const calls: string[] = [];
    const manifest = createManifest({
      'a.b': { paths: ['a.b'], chunk: 'binding=a.b', bindings: ['t1'], covers: ['a'] },
      'a.c': { paths: ['a.c'], chunk: 'binding=a.c', bindings: ['t2'], covers: ['a'] },
      a: { paths: ['a'], chunk: 'binding=a', bindings: ['t0'], covers: [] },
    });
    const run = (name: string) => () => {
      calls.push(name);
    };
    const chunks: Record<string, object> = {
      'binding=a.b': { t1: run('t1'), t0: run('t0') },
      'binding=a.c': { t2: run('t2'), t0: run('t0') },
    };
    const html = '<!--t0-->x<!--/t--><!--t1-->x<!--/t--><!--t2-->x<!--/t-->';
    const page = createPage(html, manifest, (_module, chunk) => Promise.resolve(chunks[chunk]));
    await createPatch(vi.fn())(page, { a: { b: 1, c: 1 } }, { a: { b: 2, c: 2 } });
    expect(calls).toEqual(['t0', 't1', 't2']);
  });

  it('skips a binding whose node is not rendered', async () => {
    const manifest = createManifest({
      x: { paths: ['x'], chunk: 'binding=x', bindings: ['t0', 't9'], covers: [] },
    });
    const t0 = vi.fn();
    const t9 = vi.fn();
    const page = createPage('<!--t0-->x<!--/t-->', manifest, () => Promise.resolve({ t0, t9 }));
    await createPatch(vi.fn())(page, { x: 1 }, { x: 2 });
    expect(t0).toHaveBeenCalledTimes(1);
    expect(t9).not.toHaveBeenCalled();
  });

  it('finds nodes outside rows on the first lookup', () => {
    const { page } = setup();
    const before = performance.now();
    expect(findNode(page.root, 'a0')?.nodeName).toBe('INPUT');
    const first = performance.now() - before;
    expect(findNode(page.root, 'a4')).toBeUndefined();
    expect(findNode(page.root, 'l3')?.nodeValue).toBe('l3');
    expect(first).toBeLessThan(50);
  });
});

describe('condition blocks', () => {
  const html =
    '<!--c0:0--><p>then</p><!--c1:0--><i>inner</i><!--/c--><!--/c-->' +
    '<!--c2:0--><b>other</b><!--/c-->';
  const branches = ['<p>then</p><!--c1:0--><i>inner</i><!--/c-->', '<em>else</em>'];

  function render(branch: number): string {
    return branches[branch];
  }

  it('swaps the branch and updates the marker', () => {
    const page = createPage(html, manifestJson, () => Promise.resolve({}));
    const start = page.root.firstChild;
    if (!isComment(start)) {
      throw new TypeError('The page starts with a marker');
    }
    setBranch(start, 1, render);
    expect(page.root.innerHTML).toBe(
      '<!--c0:1--><em>else</em><!--/c--><!--c2:0--><b>other</b><!--/c-->',
    );
    // The same branch renders nothing.
    setBranch(start, 1, () => {
      throw new Error('same branch');
    });
  });

  it('fires the hooks children first and does not await them', async () => {
    const events: string[] = [];
    const pending: Promise<void>[] = [];
    onBlock(
      (start) => {
        events.push(`add ${start.data}`);
        pending.push(new Promise(() => {}));
      },
      (start) => {
        events.push(`remove ${start.data}`);
        pending.push(new Promise(() => {}));
      },
    );
    const manifest = createManifest({
      open: { paths: ['open'], chunk: 'binding=open', bindings: ['c0'], covers: [] },
    });
    const chunk = {
      c0: (start: Comment, scope: { model: Model }) => {
        setBranch(start, scope.model.open ? 0 : 1, render);
      },
    };
    const page = createPage(html, manifest, () => Promise.resolve(chunk));
    const patch = createPatch(vi.fn());
    // Closing the block removes the inner block `c1:0` before `c0:0`.
    await patch(page, { open: true }, { open: false });
    expect(events).toEqual(['remove c1:0', 'remove c0:0', 'add c0:1']);
    events.length = 0;
    await patch(page, { open: false }, { open: true });
    expect(events).toEqual(['remove c0:1', 'add c1:0', 'add c0:0']);
    expect(page.root.innerHTML).toContain('<i>inner</i>');
    expect(pending.length).toBeGreaterThan(0);
  });
});
