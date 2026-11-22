import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';
import { parseSync } from 'oxc-parser';
import { describe, expect, it, vi } from 'vitest';
import { getChunkFile, getChunkId } from '../../src/core/format.ts';
import type { Manifest, Model } from '../../src/core/format.ts';
import { createContext, diffPaths, selectChunks, slot, toClientManifest } from './reference.ts';
import { printRow } from './rows.ts';
import type { NestedContext } from './reference.ts';

// Server modules import the render helpers from the package. The reference versions stand in
// for them. Chunks copy the DOM and render helpers and import only the loader's block hooks and
// `parseHtml`, which are never called here. The nested fixtures also import `addChild` and
// `setProp`, which only the parent's template renders call, so `addChild` is the reference one.
vi.mock('idlip/server', async () => import('./reference.ts'));
vi.mock('idlip/client', async () => {
  const reference = await import('./reference.ts');
  return {
    addBlock: vi.fn(),
    addChild: reference.addChild,
    findInnerBlocks: vi.fn(),
    parseHtml: vi.fn(),
    removeBlock: vi.fn(),
    setProp: vi.fn(),
  };
});
// A parent imports its child's server module by the source's specifier. The compiler's output
// resolves it to the child's server module, which here is the expected file. The parent's
// template chunk imports the child's view chunk by id.
vi.mock('./nested/counter/counter.tsx', async () => {
  const server = await vi.importActual<Record<string, unknown>>(
    './nested/counter/expected/server.js',
  );
  // A module with no children has no `uses` export, and a mock throws on a missing export.
  return { uses: [], ...server };
});
vi.mock('/src/counter.tsx?idlip-view&lang.js', async () =>
  vi.importActual<Record<string, unknown>>('./nested/counter/expected/client/view.js'),
);

const FIXTURES = ['counter', 'todo', 'effects', 'nested/counter', 'nested/board', 'try'];

type Exports = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      return false;
    }
  }
  return true;
}

function isEntries(value: unknown, check: (entry: Record<string, unknown>) => boolean): boolean {
  if (!isRecord(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (!isRecord(entry) || !check(entry)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks the shape of a manifest read from JSON.
 */
function isManifest(value: unknown): value is Manifest {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.module !== 'string' || !isStrings(value.events)) {
    return false;
  }
  const handlers = isEntries(value.handlers, (entry) => typeof entry.chunk === 'string');
  const groups = isEntries(
    value.groups,
    (entry) =>
      isStrings(entry.paths) &&
      typeof entry.chunk === 'string' &&
      isStrings(entry.bindings) &&
      isStrings(entry.covers),
  );
  const lists = isEntries(
    value.lists,
    (entry) =>
      typeof entry.key === 'string' &&
      typeof entry.chunk === 'string' &&
      isStrings(entry.bindings) &&
      (entry.path === undefined || typeof entry.path === 'string') &&
      (entry.parent === undefined || typeof entry.parent === 'string'),
  );
  return handlers && groups && lists;
}

function readText(...parts: string[]): string {
  return readFileSync(join(import.meta.dirname, ...parts), 'utf8');
}

function readManifest(name: string): Manifest {
  const value: unknown = JSON.parse(readText(name, 'expected', 'manifest.json'));
  if (!isManifest(value)) {
    throw new Error(`${name}: manifest.json has the wrong shape`);
  }
  return value;
}

interface Input {
  id: string;
  source: string;
  props: Record<string, unknown>;
}

function readInput(name: string): Input {
  const value: unknown = JSON.parse(readText(name, 'input.json'));
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.source !== 'string' ||
    !isRecord(value.props)
  ) {
    throw new Error(`${name}: input.json has the wrong shape`);
  }
  return { id: value.id, source: value.source, props: value.props };
}

async function importModule(...parts: string[]): Promise<Exports> {
  const value: unknown = await import(join(import.meta.dirname, ...parts));
  if (!isRecord(value)) {
    throw new Error(`${parts.join('/')} is not a module`);
  }
  return value;
}

async function importChunk(name: string, chunk: string): Promise<Exports> {
  return importModule(name, 'expected', 'client', getChunkFile(chunk));
}

function callExport(exports: Exports, name: string, ...args: unknown[]): unknown {
  const value = exports[name];
  if (typeof value !== 'function') {
    throw new Error(`No function export ${name}`);
  }
  const result: unknown = Reflect.apply(value, undefined, args);
  return result;
}

function listChunks(manifest: Manifest): string[] {
  const chunks = new Set<string>();
  for (const entry of Object.values(manifest.handlers)) {
    chunks.add(entry.chunk);
  }
  for (const chunk of Object.values(manifest.tasks ?? {})) {
    chunks.add(chunk);
  }
  for (const group of Object.values(manifest.groups)) {
    chunks.add(group.chunk);
  }
  for (const list of Object.values(manifest.lists)) {
    chunks.add(list.chunk);
  }
  for (const chunk of Object.values(manifest.fallback ?? {})) {
    chunks.add(chunk);
  }
  // A module that a parent renders as a child has a view chunk (`nesting-format`).
  const view: unknown = Reflect.get(manifest, 'view');
  if (isRecord(view) && typeof view.chunk === 'string') {
    chunks.add(view.chunk);
  }
  return [...chunks];
}

function findGroupOf(manifest: Manifest, binding: string): string {
  for (const [key, group] of Object.entries(manifest.groups)) {
    if (group.bindings.includes(binding)) {
      return key;
    }
  }
  throw new Error(`No group holds ${binding}`);
}

function hasPrefix(path: string, prefixes: readonly string[]): boolean {
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}.`)) {
      return true;
    }
  }
  return false;
}

/**
 * Renders a fixture's server module and returns its HTML and the model it recorded.
 */
async function renderServer(name: string): Promise<{ html: string; model: Model }> {
  const server = await importModule(name, 'expected', 'server.js');
  const { context, writeState } = createContext();
  let model: Model = {};
  const recorder: NestedContext = {
    state(state, path) {
      if (path === undefined || path === '') {
        model = state.model;
      }
      context.state(state, path);
    },
  };
  const markup = callExport(server, 'default', readInput(name).props, recorder);
  if (typeof markup !== 'string') {
    throw new Error(`${name}: the render function returned no string`);
  }
  return { html: markup + writeState(), model };
}

/**
 * Lists the comment markers in a page, in document order.
 */
function listComments(page: string): { comments: string[]; window: Window } {
  const window = new Window();
  window.document.body.innerHTML = page;
  const walker = window.document.createTreeWalker(
    window.document.body,
    window.NodeFilter.SHOW_COMMENT,
  );
  const comments: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    comments.push(node.textContent);
  }
  return { comments, window };
}

describe.each(FIXTURES)('fixture %s', (name) => {
  const input = readInput(name);
  const manifest = readManifest(name);
  const page = readText(name, 'expected', 'page.html').trimEnd();

  it('parses the source and every expected module', () => {
    const source = readText(name, input.source);
    expect(parseSync(input.source, source).errors).toEqual([]);
    const server = readText(name, 'expected', 'server.js');
    expect(parseSync('server.js', server).errors).toEqual([]);
    for (const file of readdirSync(join(import.meta.dirname, name, 'expected', 'client'))) {
      const code = readText(name, 'expected', 'client', file);
      expect(parseSync(file, code).errors, file).toEqual([]);
    }
  });

  it('exports the manifest from the server module', async () => {
    const server = await importModule(name, 'expected', 'server.js');
    expect(server.manifest).toEqual(manifest);
    expect(manifest.module).toBe(input.id);
  });

  it('maps the id of every chunk to its URL in the server module', async () => {
    const server = await importModule(name, 'expected', 'server.js');
    const expected: Record<string, string> = {};
    for (const chunk of listChunks(manifest)) {
      const id = getChunkId(manifest.module, chunk);
      // In dev the id is the URL. `vite-plugin` writes built URLs in a build.
      expected[id] = id;
    }
    expect(server.chunks).toEqual(expected);
  });

  it('has one file per chunk in the manifest', () => {
    const files = readdirSync(join(import.meta.dirname, name, 'expected', 'client')).toSorted();
    const expected: string[] = [];
    for (const chunk of listChunks(manifest)) {
      expected.push(getChunkFile(chunk));
    }
    expect(files).toEqual(expected.toSorted());
  });

  it('exports each tag from its handler chunk', async () => {
    for (const [tag, entry] of Object.entries(manifest.handlers)) {
      const chunk = await importChunk(name, entry.chunk);
      expect(typeof chunk[tag], `${entry.chunk} exports ${tag}`).toBe('function');
    }
  });

  it('exports the bindings of each group and of the groups it covers', async () => {
    const keys = Object.keys(manifest.groups);
    for (const [key, group] of Object.entries(manifest.groups)) {
      expect(group.paths.join(',')).toBe(key);
      const chunk = await importChunk(name, group.chunk);
      const expected = [...group.bindings];
      for (const covered of group.covers) {
        expect(keys, `${key} covers ${covered}`).toContain(covered);
        const other = manifest.groups[covered];
        // A group covers another only when every change to it changes the other.
        for (const path of group.paths) {
          expect(hasPrefix(path, other.paths)).toBe(true);
        }
        // The patcher walks groups in order, so a covering group comes first.
        expect(keys.indexOf(covered)).toBeGreaterThan(keys.indexOf(key));
        expected.push(...other.bindings);
      }
      expect(Object.keys(chunk).toSorted()).toEqual(expected.toSorted());
    }
  });

  it('places every row binding of a list in a group', () => {
    const grouped = new Set<string>();
    for (const group of Object.values(manifest.groups)) {
      for (const binding of group.bindings) {
        grouped.add(binding);
      }
    }
    for (const list of Object.values(manifest.lists)) {
      for (const binding of list.bindings) {
        expect(grouped.has(binding)).toBe(true);
      }
    }
  });

  it('renders the expected page', async () => {
    const { html } = await renderServer(name);
    expect(html).toBe(page);
  });

  it('renders each list row as the server does', async () => {
    const { model } = await renderServer(name);
    // A row is HTML or a cloned fragment, so both sides print as nodes in a DOM.
    const window = new Window();
    const globals = ['document', 'Node', 'DocumentFragment', 'Element'] as const;
    for (const key of globals) {
      Reflect.set(globalThis, key, Reflect.get(window, key));
    }
    for (const [id, list] of Object.entries(manifest.lists)) {
      const template = await importChunk(name, list.chunk);
      const group = manifest.groups[findGroupOf(manifest, `l${id}`)];
      const items = callExport(await importChunk(name, group.chunk), `l${id}`, {
        model,
        props: {},
        rows: [],
      });
      if (!Array.isArray(items)) {
        throw new Error(`l${id} returned no list`);
      }
      const values: unknown[] = items;
      let rows = '';
      for (const [index, item] of values.entries()) {
        const scope = { model, props: {}, rows: [{ item, index }] };
        rows += printRow(callExport(template, 'render', scope, document));
      }
      const start = page.indexOf(`<!--l${id}-->`) + `<!--l${id}-->`.length;
      const end = page.indexOf('<!--/l-->', start);
      expect(rows).toBe(printRow(page.slice(start, end)));
    }
    for (const key of globals) {
      Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });

  it('marks the node of every binding in the page', async () => {
    const { comments, window } = listComments(page);
    for (const group of Object.values(manifest.groups)) {
      for (const binding of group.bindings) {
        const kind = binding[0];
        const id = binding.slice(1);
        if (kind === 'p') {
          // A props binding has no node: it names a slot by path (`nesting-format`).
          continue;
        }
        if (kind === 'a') {
          expect(window.document.querySelector(`[i-a~="${id}"]`), binding).not.toBeNull();
        } else if (kind === 'c') {
          expect(comments, binding).toContainEqual(expect.stringMatching(`^c${id}:[01]$`));
        } else {
          expect(comments, binding).toContain(`${kind}${id}`);
        }
      }
    }
    await window.happyDOM.close();
  });
});

describe('path diff and chunk choice', () => {
  const manifest = readManifest('todo');
  const a1 = { id: 'a1', text: 'Write the format', done: true };
  const a2 = { id: 'a2', text: 'Build <the> runtime', done: false };
  const model = { draft: '', todos: [a1, a2], next: 3 };

  it('loads only binding=todos.*.done on the first toggle', async () => {
    const toggle = await importChunk('todo', 'handler=toggle');
    const next = callExport(toggle, 'toggle', model, ['a2']);
    if (!isRecord(next)) {
      throw new Error('toggle returned no model');
    }
    expect(selectChunks(manifest, model, next)).toEqual(['binding=todos.*.done']);
  });

  it('pairs rows by key, so a reorder that moves `done` is a change', () => {
    const prev = {
      todos: [
        { id: 'a1', done: false },
        { id: 'a2', done: true },
      ],
    };
    const next = {
      todos: [
        { id: 'a2', done: false },
        { id: 'a1', done: true },
      ],
    };
    const keys = { todos: 'id' };
    // By index both lists read [false, true]. By key, a1 and a2 both flip.
    expect(diffPaths(prev, next, ['todos.*.done'], keys)).toEqual(new Set(['todos.*.done']));
    expect(diffPaths(prev, next, ['todos.*.done'], {})).toEqual(new Set());
  });

  it('counts a change by index, for holes outside rows', () => {
    // `{todos[selected].done ? 'yes' : 'no'}` reads `selected` and `todos.*.done`.
    const first = { id: 'a1', done: false };
    const second = { id: 'a2', done: true };
    const prev = { selected: 0, todos: [first, second] };
    const next = { selected: 0, todos: [second, first] };
    const paths = ['selected', 'todos.*.done'];
    // By key no item changed, but index 0 now reads a2, so the hole must patch.
    expect(diffPaths(prev, next, paths, { todos: 'id' })).toEqual(new Set(['todos.*.done']));
  });

  it('counts an added row as a change of the item paths', () => {
    const prev = { todos: [a1] };
    const next = { todos: [a1, a2] };
    expect(diffPaths(prev, next, ['todos', 'todos.*.done'], { todos: 'id' })).toEqual(
      new Set(['todos', 'todos.*.done']),
    );
  });
});

describe('handler chunks', () => {
  it('count up, add and reset in the counter', async () => {
    const increment = await importChunk('counter', 'handler=increment');
    const add = await importChunk('counter', 'handler=add');
    const reset = await importChunk('counter', 'handler=reset');
    expect(callExport(increment, 'increment', { count: 4 }, [])).toEqual({ count: 5 });
    expect(callExport(add, 'add', { count: 4 }, [10])).toEqual({ count: 14 });
    // `reset` reads `props.start`, which rides in the payload after the arguments.
    expect(callExport(reset, 'reset', { count: 9 }, [4])).toEqual({ count: 4 });
  });

  it('add, clear and toggle todos', async () => {
    const add = await importChunk('todo', 'handler=add');
    const toggle = await importChunk('todo', 'handler=toggle');
    const clear = await importChunk('todo', 'handler=clear');
    const todo = { id: 'a1', text: 'One', done: false };
    const model = { draft: 'Two', todos: [todo], next: 2 };
    expect(callExport(add, 'add', model, [])).toEqual({
      draft: '',
      todos: [todo, { id: 't2', text: 'Two', done: false }],
      next: 3,
    });
    expect(callExport(add, 'add', { ...model, draft: '' }, [])).toEqual({ ...model, draft: '' });
    expect(callExport(toggle, 'toggle', model, ['a1'])).toEqual({
      ...model,
      todos: [{ ...todo, done: true }],
    });
    expect(callExport(clear, 'clear', model, [])).toEqual({ ...model, draft: '' });
  });
});

interface RecordedState {
  events: string;
  state: Record<string, unknown>;
}

/**
 * Runs the state script of a page, as the loader does on the first event.
 */
function readState(page: string): RecordedState {
  const match = /<script i-state>(.*)<\/script>/s.exec(page);
  if (match === null) {
    throw new Error('The page has no state script');
  }
  const boot: { $idlip?: unknown[] } = {};
  runInNewContext(match[1], { self: boot });
  const record: unknown = boot.$idlip?.[0];
  if (!Array.isArray(record)) {
    throw new Error('The state script pushed no record');
  }
  const items: readonly unknown[] = record;
  const events = items[0];
  const load = items[1];
  if (typeof events !== 'string' || typeof load !== 'function') {
    throw new Error('The state record has the wrong shape');
  }
  const state: unknown = Reflect.apply(load, undefined, []);
  if (!isRecord(state)) {
    throw new Error('The state record returned no state');
  }
  return { events, state };
}

describe('nested components', () => {
  const page = readText('nested/board', 'expected', 'page.html').trimEnd();
  const boardManifest = readManifest('nested/board');

  it('pairs each boundary marker with a slot in the state script', async () => {
    const { comments, window } = listComments(page);
    const opened: string[] = [];
    let depth = 0;
    for (const comment of comments) {
      if (comment.startsWith('n:')) {
        opened.push(comment.slice(2));
        depth++;
      } else if (comment === '/n') {
        depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
    }
    expect(depth).toBe(0);
    const { state } = readState(page);
    const slots = state.slots;
    if (!isRecord(slots)) {
      throw new Error('The state has no slots');
    }
    expect(Object.keys(slots).toSorted()).toEqual(opened.toSorted());
    expect(opened).toEqual(['0', '1:a1', '1:a2']);
    for (const entry of Object.values(slots)) {
      expect(entry).toMatchObject({ module: '/src/counter.tsx' });
    }
    await window.happyDOM.close();
  });

  it('writes the child manifests and the union of the event types', () => {
    const { events, state } = readState(page);
    expect(events).toBe('click');
    expect(boardManifest.events).toEqual([]);
    expect(state.modules).toEqual({
      '/src/counter.tsx': toClientManifest(readManifest('nested/counter')),
    });
  });

  it('gives a child its own handlers without a path and a message prop its owner', () => {
    // `increment` is the child's: the loader reads its path from the boundary around the target.
    expect(page).toContain(`on:click='["increment",[]]'`);
    // `remove` and `clearAll` belong to the board, the root, so the owner is the empty path.
    expect(page).toContain(`on:click='["remove",["a1"],"",""]'`);
    expect(page).toContain(`on:click='["clearAll",[],"",""]'`);
  });

  it('builds slot paths from the site and the loop keys', () => {
    expect(slot('', 0)).toBe('0');
    expect(slot('', 1, 'a1')).toBe('1:a1');
    expect(slot('1:a1', 0)).toBe('1:a1/0');
    expect(slot('', 2, 'x', 'y')).toBe('2:x:y');
    // `/`, `:` and `-` never appear in a key part, so a path splits and a comment stays valid.
    expect(slot('', 1, 'a/b:c--d>')).toBe('1:a%2Fb%3Ac%2D%2Dd%3E');
  });

  it('sets the props of a slot from the parent bindings', async () => {
    const client = await import('idlip/client');
    const setProp: unknown = Reflect.get(client, 'setProp');
    if (!vi.isMockFunction(setProp)) {
      throw new Error('setProp is not the mock');
    }
    setProp.mockClear();
    const label = await importChunk('nested/board', 'binding=items.*.label');
    const id = await importChunk('nested/board', 'binding=items.*.id');
    const row = { item: { id: 'a1', label: 'Uno' }, index: 0 };
    callExport(label, 'p3', { model: {}, props: {}, rows: [row] });
    callExport(id, 'p4', { model: {}, props: {}, rows: [row], path: '3' });
    expect(setProp.mock.calls).toEqual([
      ['1:a1', 'label', 'Uno'],
      ['3/1:a1', 'onRemove', ['remove', ['a1'], '', '3']],
    ]);
  });

  it('keeps every slot path when the rows are reordered', async () => {
    const client = await import('idlip/client');
    const setProp: unknown = Reflect.get(client, 'setProp');
    if (!vi.isMockFunction(setProp)) {
      throw new Error('setProp is not the mock');
    }
    setProp.mockClear();
    const first = { id: 'a1', label: 'First' };
    const second = { id: 'a2', label: 'Second' };
    const prev = { items: [first, second] };
    const next = { items: [second, first] };
    // By index both row groups changed, so their chunks load and the bindings run on each row.
    expect(selectChunks(boardManifest, prev, next)).toEqual([
      'binding=items.*.id',
      'binding=items.*.label',
    ]);
    const label = await importChunk('nested/board', 'binding=items.*.label');
    for (const [index, item] of next.items.entries()) {
      callExport(label, 'p3', { model: next, props: {}, rows: [{ item, index }] });
    }
    // The paths hold keys, and each label goes to the slot of its own key. Nothing is removed.
    expect(setProp.mock.calls).toEqual([
      ['1:a2', 'label', 'Second'],
      ['1:a1', 'label', 'First'],
    ]);
    expect(slot('', 1, 'a1')).toBe('1:a1');
  });

  it('loads only the label chunk when a label changes, and updates the list on remove', async () => {
    const first = { id: 'a1', label: 'First' };
    const second = { id: 'a2', label: 'Second' };
    const model = { items: [first, second] };
    const relabeled = { items: [{ ...first, label: 'Uno' }, second] };
    expect(selectChunks(boardManifest, model, relabeled)).toEqual(['binding=items.*.label']);
    const remove = await importChunk('nested/board', 'handler=remove');
    expect(callExport(remove, 'remove', model, ['a1'])).toEqual({ items: [second] });
  });
});
