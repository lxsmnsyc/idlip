import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { compileHandlers } from '../../../src/compiler/update/index.ts';
import { getChunkFile } from '../../../src/core/format.ts';

const FIXTURE = join(import.meta.dirname, '..', '..', 'fixtures', 'effects');
const HEAD = `import type { JSX } from 'idlip/jsx-runtime';\n`;

type Exports = Record<string, unknown>;

async function importChunk(chunk: string): Promise<Exports> {
  const value: unknown = await import(join(FIXTURE, 'expected', 'client', getChunkFile(chunk)));
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`${chunk} is not a module`);
  }
  return Object.fromEntries(Object.entries(value));
}

function call(exports: Exports, name: string, ...args: unknown[]): unknown {
  const fn = exports[name];
  if (typeof fn !== 'function') {
    throw new TypeError(`No function export ${name}`);
  }
  const result: unknown = Reflect.apply(fn, undefined, args);
  return result;
}

/** Compiles a source and returns the code of each chunk by name, and the rules reported. */
function build(source: string): { code: Record<string, string>; rules: string[] } {
  const result = compileHandlers('/src/test.idlip.tsx', source);
  const code: Record<string, string> = {};
  for (const module of result.client) {
    code[module.chunk] = module.code;
  }
  const rules: string[] = [];
  for (const diagnostic of result.diagnostics) {
    rules.push(diagnostic.rule);
  }
  return { code, rules };
}

const ok = (value: unknown): unknown => ({ ok: true, value });
const fail = (error: unknown): unknown => ({ ok: false, error });

describe('effects fixture', () => {
  const source = readFileSync(join(FIXTURE, 'effects.idlip.tsx'), 'utf8');
  const result = compile(source, '/src/effects.idlip.tsx');

  it('reports no diagnostics', () => {
    expect(result.diagnostics).toEqual([]);
  });

  it('emits the golden handler and task chunks, and no others', () => {
    const dir = join(FIXTURE, 'expected', 'client');
    const expected: string[] = [];
    for (const file of readdirSync(dir)) {
      if (file.startsWith('handler.') || file.startsWith('task.')) {
        expected.push(file);
      }
    }
    const emitted: string[] = [];
    for (const module of result.client) {
      if (module.chunk.startsWith('handler=') || module.chunk.startsWith('task=')) {
        const file = getChunkFile(module.chunk);
        emitted.push(file);
        expect(module.code, file).toBe(readFileSync(join(dir, file), 'utf8'));
      }
    }
    expect(emitted.toSorted()).toEqual(expected.toSorted());
  });

  it('writes the golden manifest', () => {
    const golden: unknown = JSON.parse(
      readFileSync(join(FIXTURE, 'expected', 'manifest.json'), 'utf8'),
    );
    expect(result.manifest).toEqual(golden);
  });

  it('puts continuations in the chunk of their handler and maps each site to a task chunk', () => {
    expect(result.manifest.handlers.persist$1).toEqual({
      chunk: 'handler=persist',
      writes: ['save', 'saved', 'label'],
      bindings: ['save.state', 'label', 'saved'],
    });
    expect(result.manifest.handlers.rename$2).toEqual({
      chunk: 'handler=rename',
      writes: ['label'],
      bindings: ['label'],
    });
    expect(result.manifest.tasks).toEqual({
      add$1: 'task=add$1',
      persist$1: 'task=persist$1',
      rename$1: 'task=rename$1',
      rename$2: 'task=rename$2',
    });
  });

  it('keeps the awaited imports out of the handler chunks', () => {
    for (const module of result.client) {
      if (module.chunk.startsWith('handler=')) {
        expect(module.code, module.chunk).not.toContain('import ');
      }
    }
  });
});

describe('semantics of the effects fixture', () => {
  const model = {
    draft: 'milk',
    todos: [{ id: 'a', text: 'one', done: false }],
    save: { state: 'idle' },
    label: '',
    saved: 4,
  };

  it('returns the model and a task at the await', async () => {
    const chunk = await importChunk('handler=add');
    expect(call(chunk, 'add', model, [])).toEqual({
      model,
      task: { site: 'add$1', args: [], then: 'add$1', carried: ['milk'] },
    });
    // The early return of the first part still returns the model.
    expect(call(chunk, 'add', { ...model, draft: '' }, [])).toEqual({ ...model, draft: '' });
  });

  it('reads the model of the moment after an await, and the carried local from before', async () => {
    const chunk = await importChunk('handler=add');
    // The draft changed and a todo arrived while the id was pending.
    const later = {
      ...model,
      draft: 'bread',
      todos: [...model.todos, { id: 'b', text: 'two', done: true }],
    };
    expect(call(chunk, 'add$1', later, [ok('x1'), 'milk'])).toEqual({
      ...later,
      draft: '',
      todos: [...later.todos, { id: 'x1', text: 'milk', done: false }],
    });
  });

  it('rethrows a rejection that no try catches', async () => {
    const chunk = await importChunk('handler=add');
    expect(() => call(chunk, 'add$1', model, [fail(new Error('no id')), 'milk'])).toThrow('no id');
  });

  it('carries locals in order, one more with each await', async () => {
    const chunk = await importChunk('handler=rename');
    const start = call(chunk, 'rename', model, ['todo']);
    expect(start).toEqual({
      model,
      task: { site: 'rename$1', args: ['todo', 1], then: 'rename$1', carried: [1] },
    });
    const middle = call(chunk, 'rename$1', model, [ok('todo-a'), 1]);
    expect(middle).toEqual({
      model,
      task: { site: 'rename$2', args: ['todo-a', 1], then: 'rename$2', carried: ['todo-a', 1] },
    });
    expect(call(chunk, 'rename$2', model, [ok('b'), 'todo-a', 1])).toEqual({
      ...model,
      label: 'todo-a:b:1',
    });
  });

  it('sets the state before the await in the returned model', async () => {
    const chunk = await importChunk('handler=persist');
    expect(call(chunk, 'persist', model, [2])).toEqual({
      model: { ...model, save: { state: 'saving' } },
      task: { site: 'persist$1', args: [model.todos], then: 'persist$1', carried: [2] },
    });
  });

  it('runs the try branch on { ok: true } and then the code after the try', async () => {
    const chunk = await importChunk('handler=persist');
    const saving = { ...model, save: { state: 'saving' } };
    expect(call(chunk, 'persist$1', saving, [ok(undefined), 2])).toEqual({
      ...saving,
      save: { state: 'idle' },
      saved: 6,
      label: 'done',
    });
  });

  it('runs the catch branch on { ok: false } and then the code after the try', async () => {
    const chunk = await importChunk('handler=persist');
    const saving = { ...model, save: { state: 'saving' } };
    expect(call(chunk, 'persist$1', saving, [fail(new Error('offline')), 2])).toEqual({
      ...saving,
      save: { state: 'failed', error: 'Error: offline' },
      label: 'done',
    });
  });
});

describe('task chunks', () => {
  it('exports run, which calls the import', () => {
    const code = readFileSync(join(FIXTURE, 'expected', 'client', 'task.rename$1.js'), 'utf8');
    expect(code).toBe(`import { loadLabel } from './api.ts';

export function run(...args) {
  return loadLabel(...args);
}
`);
  });

  it('copies a module-level function with its helper and import', () => {
    const { code, rules } = build(`${HEAD}
import { post } from './post.ts';
const BASE = '/api/';
function url(path: string): string {
  return BASE + path;
}
async function send(path: string, body: string) {
  return post(url(path), body);
}
export default function A(): JSX.Element {
  let sent = 0;
  async function go() {
    await send('x', 'y');
    sent = sent + 1;
  }
  return <button on:click={() => go()}>{sent}</button>;
}
`);
    expect(rules).toEqual([]);
    expect(code['task=go$1']).toBe(`import { post } from './post.ts';

const BASE = '/api/';
function url(path) {
  return BASE + path;
}
async function send(path, body) {
  return post(url(path), body);
}

export function run(...args) {
  return send(...args);
}
`);
    expect(code['handler=go']).not.toContain('send');
    expect(code['handler=go']).not.toContain('import');
  });

  it('calls a member of a namespace import as written', () => {
    const { code } = build(`${HEAD}
import * as api from './api.ts';
export default function A(): JSX.Element {
  let n = 0;
  async function go() {
    n = await api.count();
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(code['task=go$1']).toBe(`import * as api from './api.ts';

export function run(...args) {
  return api.count(...args);
}
`);
    expect(code['handler=go']).toContain('n = $outcome.value;');
  });
});

describe('built-in sites', () => {
  it('copies Time.sleep and Time.now into the handler chunk and loads no task chunk', () => {
    const { code, rules } = build(`${HEAD}
import { Time } from 'idlip';
export default function A(): JSX.Element {
  let at = 0;
  async function wait() {
    await Time.sleep(50);
    at = await Time.now();
  }
  return <button on:click={() => wait()}>{at}</button>;
}
`);
    expect(rules).toEqual([]);
    expect(Object.keys(code)).toEqual(['handler=wait']);
    expect(code['handler=wait']).toContain('export function task$wait$1(ms, signal) {');
    expect(code['handler=wait']).toContain('export function task$wait$2() {');
    expect(code['handler=wait']).toContain('return Date.now();');
    expect(code['handler=wait']).not.toContain('import');
  });

  it('treats a Random that is not from idlip as an ordinary import', () => {
    const { code } = build(`${HEAD}
import { Random } from './random.ts';
export default function A(): JSX.Element {
  let id = '';
  async function make() {
    id = await Random.id();
  }
  return <button on:click={() => make()}>{id}</button>;
}
`);
    expect(Object.keys(code).toSorted()).toEqual(['handler=make', 'task=make$1']);
  });
});

describe('placement and props', () => {
  it('carries the props a continuation reads', () => {
    const { code, rules } = build(`${HEAD}
import { load } from './load.ts';
export default function A(props: { step: number }): JSX.Element {
  let n = 0;
  async function go() {
    const v = await load();
    n = v + props.step;
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(rules).toEqual([]);
    expect(code['handler=go']).toContain('export function go(model, [props$step]) {');
    expect(code['handler=go']).toContain('carried: [props$step]');
    expect(code['handler=go']).toContain('export function go$1(model, [$outcome, props$step]) {');
  });

  it('takes the await out of a nested position of its statement', () => {
    const { code } = build(`${HEAD}
import { load } from './load.ts';
export default function A(): JSX.Element {
  let user = { name: '' };
  async function go(id: string) {
    user = { name: (await load(id)) as string };
  }
  return <button on:click={() => go('a')}>{user.name}</button>;
}
`);
    expect(code['handler=go']).toContain('user = { name: ($outcome.value) };');
  });

  it('reports an await in a catch block', () => {
    const { rules } = build(`${HEAD}
import { a, b } from './x.ts';
export default function A(): JSX.Element {
  let n = 0;
  async function go() {
    try {
      await a();
    } catch {
      await b();
    }
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(rules).toContain('await-nested');
  });

  it('reports an await in a try that has a finally', () => {
    const { code, rules } = build(`${HEAD}
import { a } from './x.ts';
export default function A(): JSX.Element {
  let n = 0;
  async function go() {
    try {
      await a();
    } finally {
      n = 1;
    }
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(rules).toContain('await-finally');
    expect(code).toEqual({});
  });

  it('reports two awaits in one statement', () => {
    const { rules } = build(`${HEAD}
import { a, b } from './x.ts';
export default function A(): JSX.Element {
  let n = 0;
  async function go() {
    n = (await a()) + (await b());
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(rules).toContain('await-multiple');
  });

  it('reports a handler that awaits and is called by another', () => {
    const { rules } = build(`${HEAD}
import { a } from './x.ts';
export default function A(): JSX.Element {
  let n = 0;
  async function inner() {
    n = await a();
  }
  function outer() {
    inner();
  }
  return <button on:click={() => outer()}>{n}</button>;
}
`);
    expect(rules).toContain('await-handler');
  });

  it('runs an async handler without an await as one function', () => {
    const { code, rules } = build(`${HEAD}
export default function A(): JSX.Element {
  let n = 0;
  async function go() {
    n = n + 1;
  }
  return <button on:click={() => go()}>{n}</button>;
}
`);
    expect(rules).toEqual([]);
    expect(code['handler=go']).toBe(`export function go(model) {
  let { n } = model;
  n = n + 1;
  return { ...model, n };
}
`);
  });
});
