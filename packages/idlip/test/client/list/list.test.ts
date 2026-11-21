// oxlint-disable typescript/no-unsafe-type-assertion, typescript/promise-function-async
import { join } from 'node:path';
import * as fc from 'fast-check';
import { Window } from 'happy-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Binding,
  ListChunk,
  ListContext,
  Manifest,
  Model,
  NodeBinding,
  Page,
  Scope,
} from '../../../src/core/format.ts';
import { patchList } from '../../../src/client/list/index.ts';
import { onBlock } from '../../../src/client/patch/index.ts';
import { createContext, text } from '../../fixtures/reference.ts';
import todoManifest from '../../fixtures/todo/expected/manifest.json' with { type: 'json' };

// The fixture's server module and item template chunk render with the reference helpers.
vi.mock('idlip/server', async () => import('../../fixtures/reference.ts'));
vi.mock('idlip/client', async () => import('../../fixtures/reference.ts'));

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const window = new Window();
globalThis.document = window.document as unknown as Document;

const fixture = join(import.meta.dirname, '../../fixtures/todo/expected');
const todoChunk = (await import(join(fixture, 'client/list.3.js'))) as ListChunk;
const todoServer = (await import(join(fixture, 'server.js'))) as {
  default: (props: object, context: ReturnType<typeof createContext>['context']) => string;
};

const added: string[] = [];
const removed: string[] = [];
onBlock(
  (block) => {
    added.push(block.data);
  },
  (block) => {
    removed.push(block.data);
  },
);

beforeEach(() => {
  added.length = 0;
  removed.length = 0;
});

function makePage(manifest: Manifest, chunks: Record<string, ListChunk>): Page {
  return {
    root: document.body,
    manifest,
    props: {},
    load: (_module, chunk) => Promise.resolve(chunks[chunk]),
  };
}

function makeScope(model: Model): Scope {
  return { model, props: {}, rows: [] };
}

// Serializes a tree with sorted attributes, since a patch may write them in another order.
function snapshot(node: Node): string {
  if (node.nodeType === 1) {
    const el = node as Element;
    const attrs = [...el.attributes].map((a) => `${a.name}=${a.value}`).toSorted();
    let inner = '';
    for (const child of el.childNodes) {
      inner += snapshot(child);
    }
    return `<${el.localName} ${attrs.join(' ')}>${inner}</${el.localName}>`;
  }
  if (node.nodeType === 8) {
    return `<!--${(node as Comment).data}-->`;
  }
  return node.textContent ?? '';
}

function mount(html: string, tag = 'ul'): { root: Element; start: Comment } {
  const root = document.createElement(tag);
  root.innerHTML = html;
  return { root, start: root.firstChild as Comment };
}

function setRange(start: Comment, value: string): void {
  // The end is the comment `/t`. A text node that reads `/t` is the todo's own text.
  while (
    start.nextSibling !== null &&
    !(start.nextSibling.nodeType === 8 && (start.nextSibling as Comment).data === '/t')
  ) {
    start.nextSibling.remove();
  }
  start.after(document.createTextNode(value));
}

function setFlag(el: Element, name: string, value: unknown): void {
  if (value) {
    el.setAttribute(name, value === true ? '' : String(value));
  } else {
    el.removeAttribute(name);
  }
}

// The todo's row bindings, written as the compiler would, with attribute-only helpers.
const todoBindings = new Map<string, Binding>([
  [
    'a4',
    ((el, { rows }) => {
      setFlag(el as Element, 'class', (rows[0].item as Todo).done ? 'done' : false);
    }) satisfies NodeBinding,
  ],
  [
    'a5',
    ((el, { rows }) => {
      setFlag(el as Element, 'checked', (rows[0].item as Todo).done);
    }) satisfies NodeBinding,
  ],
  [
    't6',
    ((start, { rows }) => {
      setRange(start as Comment, (rows[0].item as Todo).text);
    }) satisfies NodeBinding,
  ],
]);

// The `<ul>` content that the fixture's server module renders for a list of todos.
function renderTodos(todos: readonly Todo[]): string {
  const html = todoServer.default({ initial: todos }, createContext().context);
  return /<ul>(.*)<\/ul>/s.exec(html)?.[1] ?? '';
}

async function patchTodos(
  start: Comment,
  prev: readonly Todo[],
  next: readonly Todo[],
  bindings: ReadonlyMap<string, Binding> = todoBindings,
): Promise<void> {
  const manifest = todoManifest as Manifest;
  const context: ListContext = {
    page: makePage(manifest, { 'list=3': todoChunk }),
    list: manifest.lists['3'],
    prev: makeScope({ todos: prev }),
    next: makeScope({ todos: next }),
    bindings,
  };
  await patchList(start, prev, next, context);
}

const A: Todo = { id: 'a1', text: 'Write', done: true };
const B: Todo = { id: 'a2', text: 'Build <it>', done: false };
const C: Todo = { id: 'a3', text: 'Ship', done: false };

describe('patchList on the todo fixture', () => {
  it.each([
    ['add', [A, B], [A, B, C]],
    ['add first', [A, B], [C, A, B]],
    ['remove', [A, B, C], [A, C]],
    ['remove all', [A, B], []],
    ['fill', [], [A, B]],
    ['toggle', [A, B], [A, { ...B, done: true }]],
    ['reorder', [A, B, C], [C, A, B]],
    ['reverse', [A, B, C], [C, B, A]],
    [
      'reorder and toggle',
      [A, B],
      [
        { ...B, done: true },
        { ...A, done: false },
      ],
    ],
  ] as const)('%s', async (_name, prev, next) => {
    const { root, start } = mount(renderTodos(prev));
    await patchTodos(start, prev, next);
    expect(snapshot(root)).toBe(snapshot(mount(renderTodos(next)).root));
  });

  it('keeps the nodes of kept rows', async () => {
    const { root, start } = mount(renderTodos([A, B, C]));
    const [a, b, c] = root.querySelectorAll('li');
    await patchTodos(start, [A, B, C], [C, A, B]);
    expect([...root.querySelectorAll('li')]).toEqual([c, a, b]);
    expect(root.querySelectorAll('li')[0]).toBe(c);
  });

  it('loads the item template only when a row is inserted', async () => {
    const { start } = mount(renderTodos([A, B]));
    const load = vi.fn(() => Promise.resolve(todoChunk));
    const manifest = todoManifest as Manifest;
    const context: ListContext = {
      page: { ...makePage(manifest, {}), load },
      list: manifest.lists['3'],
      prev: makeScope({}),
      next: makeScope({}),
      bindings: new Map(),
    };
    await patchList(start, [A, B], [B, A], context);
    expect(load).not.toHaveBeenCalled();
    await patchList(start, [B, A], [B, A, C], context);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('runs no row binding when none is chosen', async () => {
    const prev = [A, B];
    const { root, start } = mount(renderTodos(prev));
    await patchTodos(start, prev, [A, { ...B, done: true }], new Map());
    expect(snapshot(root)).toBe(snapshot(mount(renderTodos(prev)).root));
  });

  it('treats a repeated key as an insert', async () => {
    const prev = [A, { ...A, text: 'Twin' }];
    const next = [A, A, B];
    const { root, start } = mount(renderTodos(prev));
    await patchTodos(start, prev, next);
    expect(snapshot(root)).toBe(snapshot(mount(renderTodos(next)).root));
    const again = [B, A, A];
    await patchTodos(start, next, again);
    expect(snapshot(root)).toBe(snapshot(mount(renderTodos(again)).root));
  });
});

type Command =
  | { kind: 'add'; text: string; at: number }
  | { kind: 'remove'; at: number }
  | { kind: 'move'; from: number; to: number }
  | { kind: 'toggle'; at: number };

const commands = fc.array(
  fc.oneof<fc.Arbitrary<Command>[]>(
    fc.record({
      kind: fc.constant('add' as const),
      text: fc.string({ maxLength: 6 }),
      at: fc.nat(10),
    }),
    fc.record({ kind: fc.constant('remove' as const), at: fc.nat(10) }),
    fc.record({ kind: fc.constant('move' as const), from: fc.nat(10), to: fc.nat(10) }),
    fc.record({ kind: fc.constant('toggle' as const), at: fc.nat(10) }),
  ),
  { maxLength: 25 },
);

function applyCommand(todos: readonly Todo[], command: Command, id: string): Todo[] {
  const next = [...todos];
  if (command.kind === 'add') {
    next.splice(command.at % (next.length + 1), 0, { id, text: command.text, done: false });
  } else if (next.length > 0 && command.kind === 'remove') {
    next.splice(command.at % next.length, 1);
  } else if (next.length > 0 && command.kind === 'move') {
    const [moved] = next.splice(command.from % next.length, 1);
    next.splice(command.to % (next.length + 1), 0, moved);
  } else if (next.length > 0 && command.kind === 'toggle') {
    const at = command.at % next.length;
    next[at] = { ...next[at], done: !next[at].done };
  }
  return next;
}

describe('patchList model test', () => {
  it('matches a fresh server render after every command', async () => {
    await fc.assert(
      fc.asyncProperty(commands, async (steps) => {
        let todos: Todo[] = [];
        const { root, start } = mount(renderTodos(todos));
        let count = 0;
        for (const step of steps) {
          count++;
          const next = applyCommand(todos, step, `n${count}`);
          await patchTodos(start, todos, next);
          todos = next;
          if (snapshot(root) !== snapshot(mount(renderTodos(todos)).root)) {
            return false;
          }
        }
        return true;
      }),
      {
        numRuns: 200,
        // A todo whose text is `/t` once ended a range early in the test's own setRange.
        examples: [
          [
            [
              { kind: 'add', text: '/t', at: 0 },
              { kind: 'toggle', at: 0 },
            ],
          ],
        ],
      },
    );
  });
});

describe('row bindings that read state outside the list', () => {
  const manifest = {
    module: '/m',
    events: [],
    handlers: {},
    groups: {},
    lists: { '1': { key: 'id', path: 'todos', chunk: 'list=1', bindings: ['a2'] } },
  } satisfies Manifest;

  function renderRows(model: Model): string {
    let html = '<!--l1-->';
    for (const todo of model.todos as Todo[]) {
      const sel = model.selected === todo.id ? ' class="sel"' : '';
      html += `<!--i--><li${sel} i-a="2">${text(todo.id)}</li><!--/i-->`;
    }
    return `${html}<!--/l-->`;
  }

  it('re-runs in every kept row when the outside state changes', async () => {
    const todos = [A, B, C];
    const prev = { todos, selected: A.id };
    const next = { todos, selected: C.id };
    const { root, start } = mount(renderRows(prev));
    const a2: NodeBinding = (el, { model, rows }) => {
      setFlag(el as Element, 'class', model.selected === (rows[0].item as Todo).id ? 'sel' : false);
    };
    const context: ListContext = {
      page: makePage(manifest, {}),
      list: manifest.lists['1'],
      prev: makeScope(prev),
      next: makeScope(next),
      bindings: new Map([['a2', a2]]),
    };
    await patchList(start, todos, todos, context);
    expect(snapshot(root)).toBe(snapshot(mount(renderRows(next)).root));
  });
});

describe('nested lists', () => {
  interface Leaf {
    id: string;
    text: string;
  }
  interface Branch {
    id: string;
    kids: Branch[];
    leaves: Leaf[];
  }

  // Three levels: l1 holds branches, l2 their kids, l3 their leaves, and t4 is a leaf's text.
  const manifest = {
    module: '/m',
    events: [],
    handlers: {},
    groups: {},
    lists: {
      '1': { key: 'id', path: 'tree', chunk: 'list=1', bindings: ['l2'] },
      '2': { key: 'id', path: 'tree.*.kids', chunk: 'list=2', bindings: ['l3'], parent: '1' },
      '3': {
        key: 'id',
        path: 'tree.*.kids.*.leaves',
        chunk: 'list=3',
        bindings: ['t4'],
        parent: '2',
      },
    },
  } satisfies Manifest;

  function renderLeaves(branch: Branch): string {
    let html = '<!--l3-->';
    for (const leaf of branch.leaves) {
      html += `<!--i--><!--t4-->${text(leaf.text)}<!--/t--><!--/i-->`;
    }
    return `${html}<!--/l-->`;
  }

  function renderKids(branch: Branch): string {
    let html = '<!--l2-->';
    for (const kid of branch.kids) {
      html += `<!--i--><section>${renderLeaves(kid)}</section><!--/i-->`;
    }
    return `${html}<!--/l-->`;
  }

  function renderTree(tree: readonly Branch[]): string {
    let html = '<!--l1-->';
    for (const branch of tree) {
      html += `<!--i--><div>${renderKids(branch)}</div><!--/i-->`;
    }
    return `${html}<!--/l-->`;
  }

  const chunks: Record<string, ListChunk> = {
    'list=1': { render: ({ rows }) => `<div>${renderKids(rows[0].item as Branch)}</div>` },
    'list=2': {
      render: ({ rows }) => `<section>${renderLeaves(rows[1].item as Branch)}</section>`,
    },
    'list=3': { render: ({ rows }) => `<!--t4-->${text((rows[2].item as Leaf).text)}<!--/t-->` },
  };

  const bindings = new Map<string, Binding>([
    ['l2', ({ rows }: Scope) => (rows[0].item as Branch).kids],
    ['l3', ({ rows }: Scope) => (rows[1].item as Branch).leaves],
    [
      't4',
      ((start, { rows }) => {
        setRange(start as Comment, (rows[2].item as Leaf).text);
      }) satisfies NodeBinding,
    ],
  ]);

  async function patchTree(start: Comment, prev: Branch[], next: Branch[]): Promise<void> {
    await patchList(start, prev, next, {
      page: makePage(manifest, chunks),
      list: manifest.lists['1'],
      prev: makeScope({ tree: prev }),
      next: makeScope({ tree: next }),
      bindings,
    });
  }

  const x = { id: 'x', text: 'one' };
  const y = { id: 'y', text: 'two' };
  const z = { id: 'z', text: 'three' };
  const leaf = (id: string, leaves: Leaf[]): Branch => ({ id, kids: [], leaves });

  it.each([
    [
      'edit a leaf three lists deep',
      [{ id: 'b', kids: [leaf('k', [x, y])], leaves: [] }],
      [{ id: 'b', kids: [leaf('k', [x, { ...y, text: 'II' }])], leaves: [] }],
    ],
    [
      'add and move leaves',
      [{ id: 'b', kids: [leaf('k', [x, y])], leaves: [] }],
      [{ id: 'b', kids: [leaf('k', [z, y, x])], leaves: [] }],
    ],
    [
      'add and remove kids',
      [{ id: 'b', kids: [leaf('k', [x])], leaves: [] }],
      [{ id: 'b', kids: [leaf('m', [y, z]), leaf('k', [])], leaves: [] }],
    ],
  ])('%s', async (_name, prev, next) => {
    const { root, start } = mount(renderTree(prev), 'div');
    await patchTree(start, prev, next);
    expect(snapshot(root)).toBe(snapshot(mount(renderTree(next), 'div').root));
  });

  it('calls the block hooks for added and removed blocks', async () => {
    const prev = [{ id: 'b', kids: [], leaves: [] }];
    const { start } = mount(renderTree(prev), 'div');
    await patchTree(start, prev, []);
    expect(removed).toEqual(['l2']);
    await patchTree(start, [], prev);
    expect(added).toEqual(['l2']);
  });

  it('removes inner blocks before outer ones', async () => {
    const { start } = mount(
      '<!--l1--><!--i--><!--c5:0--><!--l2--><!--/l--><!--/c--><!--/i--><!--/l-->',
      'div',
    );
    await patchTree(start, [{ id: 'q', kids: [], leaves: [] }], []);
    expect(removed).toEqual(['l2', 'c5:0']);
  });

  it('skips a nested list that an earlier binding in the row swapped out', async () => {
    const list = { key: 'id', path: 'tree', chunk: 'list=1', bindings: ['c5', 'l2'] };
    const swapManifest = { ...manifest, lists: { ...manifest.lists, '1': list } };
    const html = `<!--l1--><!--i--><div><!--c5:0-->${renderKids({ id: 'b', kids: [leaf('k', [x])], leaves: [] })}<!--/c--></div><!--/i--><!--/l-->`;
    const { root, start } = mount(html, 'div');
    const swap: NodeBinding = (node) => {
      const marker = node as Comment;
      while ((marker.nextSibling as Comment).data !== '/c') {
        marker.nextSibling?.remove();
      }
      marker.data = 'c5:1';
      marker.after(document.createTextNode('empty'));
    };
    const l2 = vi.fn(({ rows }: Scope) => (rows[0].item as Branch).kids);
    const tree = [{ id: 'b', kids: [leaf('k', [x])], leaves: [] }];
    await patchList(start, tree, tree, {
      page: makePage(swapManifest, {}),
      list,
      prev: makeScope({ tree }),
      next: makeScope({ tree }),
      bindings: new Map<string, Binding>([
        ['c5', swap],
        ['l2', l2],
      ]),
    });
    expect(l2).not.toHaveBeenCalled();
    expect(snapshot(root)).toBe(
      snapshot(
        mount('<!--l1--><!--i--><div><!--c5:1-->empty<!--/c--></div><!--/i--><!--/l-->', 'div')
          .root,
      ),
    );
  });
});

describe('rows in an svg', () => {
  const manifest = {
    module: '/m',
    events: [],
    handlers: {},
    groups: {},
    lists: { '1': { key: 'id', chunk: 'list=1', bindings: [] } },
  } satisfies Manifest;
  const chunk: ListChunk = {
    namespace: 'svg',
    render: ({ rows }) => `<circle r="${(rows[0].item as Todo).text}"/>`,
  };

  it('keeps the svg namespace of inserted rows', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<svg><!--l1--><!--i--><circle r="1"></circle><!--/i--><!--/l--></svg>';
    const start = root.firstElementChild?.firstChild as Comment;
    const one = { ...A, text: '1' };
    await patchList(start, [one], [one, { ...B, text: '2' }], {
      page: makePage(manifest, { 'list=1': chunk }),
      list: manifest.lists['1'],
      prev: makeScope({}),
      next: makeScope({}),
      bindings: new Map(),
    });
    const circles = root.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    expect(circles[1].namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circles[1].getAttribute('r')).toBe('2');
  });
});
