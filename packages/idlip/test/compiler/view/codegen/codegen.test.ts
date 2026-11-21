import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { format } from 'oxfmt';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../../../src/compiler/view/analyze/index.ts';
import type {
  Component,
  Event,
  ModuleIR,
  Node,
} from '../../../../src/compiler/view/analyze/index.ts';
import { compileHandlers } from '../../../../src/compiler/update/index.ts';
import { planGroups } from '../../../../src/compiler/view/codegen/plan.ts';
import type { Binding } from '../../../../src/compiler/view/codegen/plan.ts';
import { generate } from '../../../../src/compiler/view/codegen/index.ts';
import type { GenerateResult } from '../../../../src/compiler/view/codegen/index.ts';
import { getChunkFile } from '../../../../src/core/format.ts';
import type { Model } from '../../../../src/core/format.ts';
import { attr, createContext, on, text } from '../../../fixtures/reference.ts';

const FIXTURES = join(import.meta.dirname, '..', '..', '..', 'fixtures');

function readFixture(...parts: string[]): string {
  return readFileSync(join(FIXTURES, ...parts), 'utf8');
}

interface Input {
  id: string;
  source: string;
  props: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Render = (props: unknown, context: unknown) => string;

function isRender(value: unknown): value is Render {
  return typeof value === 'function';
}

function readInput(name: string): Input {
  const value: unknown = JSON.parse(readFixture(name, 'input.json'));
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

function readManifest(name: string): unknown {
  // The fixtures' own test checks the shape.
  return JSON.parse(readFixture(name, 'expected', 'manifest.json')) as unknown;
}

/** Removes the helper aliases (`setText as setText$`), which the fixtures do not use. */
function unalias(code: string): string {
  return code
    .replaceAll(/\b(\w+) as \1\$/g, '$1')
    .replaceAll(/\b(text|attr|on|set[A-Z]\w*)\$\(/g, '$1(');
}

/** Formats JS as the repo does, so only the code is compared. */
async function normalize(code: string): Promise<string> {
  const result = await format('chunk.js', code, { singleQuote: true });
  return result.code;
}

/**
 * Runs generated code as the body of a function. The code runs in this realm, so its objects
 * are ordinary objects here.
 */
function evaluate(globals: Record<string, unknown>, body: string): unknown {
  const factory: unknown = runInThisContext(
    `(function (${Object.keys(globals).join(', ')}) {\n${body}\n})`,
  );
  if (typeof factory !== 'function') {
    throw new Error('The code is not a function');
  }
  return Reflect.apply(factory, undefined, Object.values(globals));
}

/** Strips the module syntax of generated code, so a script can run it. */
function stripModule(code: string): string {
  return code
    .replaceAll(/^import .*$/gm, '')
    .replace('export default function', 'function')
    .replaceAll('export const', 'const')
    .replaceAll('export function', 'function');
}

/** Runs a generated server module with the reference helpers. */
function runServer(code: string, props: Record<string, unknown>): string {
  const body = stripModule(code);
  const name = /function (\w+)\(props, context\)/.exec(body)?.[1] ?? '';
  const render = evaluate({ text$: text, attr$: attr, on$: on }, `${body}\nreturn ${name};`);
  if (!isRender(render)) {
    throw new Error('The server module has no render function');
  }
  const { context, writeState } = createContext();
  return render(props, context) + writeState();
}

/** Evaluates the `manifest` and `chunks` constants of a server module. */
function readConsts(code: string): unknown {
  const start = code.indexOf('export const manifest');
  const end = code.indexOf('export default');
  const body = stripModule(code.slice(start, end));
  return evaluate({}, `${body}\nreturn { manifest, chunks };`);
}

/** Loads the exports of a generated client chunk, with the given helpers. */
function runChunk(code: string, helpers: Record<string, unknown>): Record<string, unknown> {
  const names: string[] = [];
  for (const match of code.matchAll(/^export (?:function|const) (\w+)/gm)) {
    names.push(match[1]);
  }
  const exports = evaluate(helpers, `${stripModule(code)}\nreturn { ${names.join(', ')} };`);
  if (!isRecord(exports)) {
    throw new Error('The chunk has no exports');
  }
  return exports;
}

/** Calls the `render` export of a list chunk. */
function renderRow(exports: Record<string, unknown>, scope: unknown): string {
  const render = exports.render;
  if (!isRender(render)) {
    throw new Error('The chunk has no render export');
  }
  return render(scope, undefined);
}

function collectEvents(nodes: Node[], events: Event[]): void {
  for (const node of nodes) {
    if (node.kind === 'element') {
      events.push(...node.events);
      collectEvents(node.children, events);
    } else if (node.kind === 'for') {
      collectEvents(node.body, events);
    } else if (node.kind === 'condition') {
      collectEvents(node.then, events);
      collectEvents(node.else, events);
    }
  }
}

function generateFixture(name: string): { result: GenerateResult; input: Input } {
  const input = readInput(name);
  const source = readFixture(name, input.source);
  return { result: generate(analyze(input.source, source), source, input.id), input };
}

function generateSource(source: string, id = '/src/test.idlip.tsx'): GenerateResult {
  return generate(analyze('test.idlip.tsx', source), source, id);
}

const NESTED = `
      import { For } from 'idlip';
      export default function App() {
        let columns = [{ id: 'a', cards: [{ id: 'x' }] }];
        let selected = 'x';
        function pick() {
          selected = 'y';
        }
        return (
          <main on:click={pick}>
            <For each={columns} key="id">
              {(column) => (
                <section>
                  <For each={column.cards} key="id">
                    {(card) => <p class={selected === card.id}>c</p>}
                  </For>
                </section>
              )}
            </For>
          </main>
        );
      }
    `;

/** The names of the `l` exports of a chunk, sorted. */
function listExports(code: string): string[] {
  const names: string[] = [];
  for (const match of code.matchAll(/export function (l\d+)\(/g)) {
    names.push(match[1]);
  }
  return names.sort();
}

/** The source of one exported function, or an empty string. */
function readFunction(code: string, name: string): string {
  const start = code.indexOf(`export function ${name}(`);
  if (start === -1) {
    return '';
  }
  return code.slice(start, code.indexOf('\n}', start) + 2);
}

describe.each(['counter', 'todo'])('fixture %s', (name) => {
  const { result, input } = generateFixture(name);

  it('has no diagnostics', () => {
    expect(result.diagnostics).toEqual([]);
  });

  it('emits the fixture manifest', () => {
    expect(result.manifest).toEqual(readManifest(name));
  });

  it('emits a server module that renders the fixture page', () => {
    const page = readFixture(name, 'expected', 'page.html');
    expect(runServer(result.server, input.props)).toBe(page.trimEnd());
  });

  it('emits the server module manifest and chunk map of the fixture', () => {
    const expected = readFixture(name, 'expected', 'server.js');
    expect(readConsts(result.server)).toEqual(readConsts(expected));
  });

  it('emits every binding and list chunk, and no handler chunk', () => {
    const names = readdirSync(join(FIXTURES, name, 'expected', 'client'))
      .filter((file) => !file.startsWith('handler.'))
      .sort();
    const emitted = result.client.map((module) => getChunkFile(module.chunk)).sort();
    expect(emitted).toEqual(names);
  });

  it('emits the binding chunks of the fixture', async () => {
    for (const module of result.client) {
      if (module.chunk.startsWith('list=')) {
        continue;
      }
      const expected = readFixture(name, 'expected', 'client', getChunkFile(module.chunk));
      expect(await normalize(unalias(module.code))).toBe(await normalize(expected));
    }
  });
});

describe('fixture todo list template', () => {
  it('renders the same rows as the fixture chunk', () => {
    const { result } = generateFixture('todo');
    const chunk = result.client.find((module) => module.chunk === 'list=3');
    const actual = runChunk(chunk?.code ?? '', { attr$: attr, on$: on, text$: text });
    const expected = runChunk(readFixture('todo', 'expected', 'client', 'list.3.js'), {
      attr,
      on,
      text,
    });
    const items = [
      { id: 'a1', text: 'one & two', done: true },
      { id: 'a2', text: '<b>', done: false },
    ];
    for (const item of items) {
      const scope = { model: {}, props: {}, rows: [{ item, index: 0 }] };
      expect(renderRow(actual, scope)).toBe(renderRow(expected, scope));
    }
  });
});

describe('events', () => {
  it('writes modifiers from the IR into the DOM message', () => {
    const { result } = generateFixture('todo');
    expect(result.server).toContain(`on:submit='["add",[],"prevent"]'`);
    expect(result.server).toContain(`on:keydown='["clear",[],"key:Escape"]'`);
  });

  it('writes every modifier kind and latest, in order', () => {
    const source = `
      export default function App() {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return <button on:click={bump}>{n}</button>;
      }
    `;
    const ir = analyze('test.idlip.tsx', source);
    const events: Event[] = [];
    collectEvents(ir.components[0].view, events);
    events[0].mode = 'latest';
    events[0].modifiers = [
      { kind: 'prevent' },
      { kind: 'stop' },
      { kind: 'once' },
      { kind: 'capture' },
      { kind: 'key', filter: 'Ctrl+s' },
    ];
    const result = generate(ir, source, '/src/test.idlip.tsx');
    expect(result.server).toContain(
      `on:click='["bump",[],"prevent stop once capture key:Ctrl+s latest"]'`,
    );
  });

  it('writes the props fields of a handler and of the handlers it calls', () => {
    const source = `
      export default function App(props: { step: number; base: number }) {
        let n = props.base;
        function inner() {
          n = n + props.step;
        }
        function outer() {
          inner();
        }
        return <button on:click={outer}>{n}</button>;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).toContain(`on$('click', ['outer', [props.step]])`);
  });

  it('writes the props of nested calls in the order of the handler chunk', () => {
    const source = `
      export default function App(props: { a: number; b: number; c: number }) {
        let n = 0;
        function leaf(x: number) {
          n = n + x + props.c;
        }
        function mid(x: number) {
          n = n + props.b;
          leaf(x);
        }
        function top(x: number) {
          mid(x);
          n = n + props.a;
        }
        return <button on:click={() => top(7)}>{n}</button>;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    const handlers = compileHandlers('test.idlip.tsx', source);
    const chunk = handlers.client.find((module) => module.chunk === 'handler=top');
    const names = /\[([^\]]*)\]\) \{/.exec(chunk?.code ?? '')?.[1] ?? '';
    const params = names.split(', ');
    const payload = /\['top', \[([^\]]*)\]\]/.exec(result.server)?.[1] ?? '';
    const values = payload.split(', ');
    expect(values.at(-1)).toBe('7');
    expect(params.length).toBe(values.length);
    for (const [index, param] of params.entries()) {
      if (param.startsWith('props$')) {
        expect(values[index]).toBe(`props.${param.slice('props$'.length).replaceAll('$', '.')}`);
      }
    }
  });

  it('computes a payload that reads props at render', () => {
    const source = `
      export default function App(props: { step: number }) {
        let n = 0;
        function add(by: number) {
          n = n + by + props.step;
        }
        return <button on:click={() => add(2)}>{n}</button>;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).toContain(`on$('click', ['add', [props.step, 2]])`);
  });

  it('marks a literal array argument that starts with $', () => {
    const source = `
      export default function App() {
        let n = 0;
        function pick(items: string[]) {
          n = items.length;
        }
        return <button on:click={() => pick(['$a', 'b'])}>{n}</button>;
      }
    `;
    const result = generateSource(source);
    expect(result.server).toContain(`on:click='["pick",[["$","$a","b"]]]'`);
  });

  it('puts a global listener in a template', () => {
    const source = `
      export default function App() {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return (
          <main>
            <window on:keydown={bump} />
            <p>{n}</p>
          </main>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).toContain(
      `<template i-global="window" on:keydown='["bump",[]]'></template>`,
    );
    expect(result.manifest.events).toEqual(['keydown']);
  });
});

describe('server module', () => {
  it('copies helpers without their types and the imports they need', () => {
    const source = `
      import { fmt } from './fmt.ts';
      import type { Row } from './types.ts';
      const PREFIX: string = '#';
      function label(row: Row, n?: number): string {
        let out = PREFIX;
        for (const ch of String(n as number)) {
          out += fmt.pad(ch);
        }
        return out;
      }
      function unused(): void {}
      export default function App() {
        let n = 1;
        function bump() {
          n = n + 1;
        }
        return <button on:click={bump}>{label(undefined, n)}</button>;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).toContain(`import { fmt } from './fmt.ts';`);
    expect(result.server).toContain('const PREFIX = ');
    expect(result.server).toContain('function label(row, n) {');
    expect(result.server).not.toContain('Row');
    expect(result.server).not.toContain('unused');
    const chunk = result.client.find((module) => module.chunk === 'binding=n');
    expect(chunk?.code).toContain('function label(row, n) {');
  });

  it('renames a state field named like the manifest', () => {
    const source = `
      export default function App() {
        let manifest = 'a';
        let chunks = 'b';
        function set(value: string) {
          manifest = value;
        }
        return <input value={manifest + chunks} on:input={(e) => set(e.currentTarget.value)} />;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(result.server).toContain('const manifest$ = ');
    expect(result.server).toContain('model: { manifest: manifest$, chunks: chunks$ }');
    expect(runServer(result.server, {})).toContain('value="ab"');
  });

  it('imports runtime helpers under aliases so a helper named text cannot clash', () => {
    const source = `
      function text(value: number): string {
        let out = '';
        for (let i = 0; i < value; i++) {
          out += 'x';
        }
        return out;
      }
      export default function App() {
        let attr = 2;
        function bump() {
          attr = attr + 1;
        }
        return <b title={text(attr)} on:click={bump}>{text(attr)}</b>;
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).toContain('text as text$');
    expect(result.server).toContain('function text(value) {');
    const html = runServer(result.server, {});
    expect(html).toContain('title="xx"');
    expect(html).toContain('<!--t1-->xx<!--/t-->');
    const chunk = result.client.find((module) => module.chunk === 'binding=attr');
    expect(chunk?.code).toContain('setText as setText$');
    expect(chunk?.code).toContain('function text(value) {');
  });

  it('orders groups so a group comes before the groups it covers', () => {
    const source = `
      export default function App() {
        let a = { b: 1, k: { l: { m: 1 } } };
        let c = { d: { e: 1 } };
        function bump() {
          a = { ...a, b: a.b + 1 };
        }
        return (
          <p on:click={bump}>
            {a.b + c.d.e}
            {a.k.l.m}
          </p>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const keys = Object.keys(result.manifest.groups);
    for (const [index, key] of keys.entries()) {
      for (const covered of result.manifest.groups[key].covers) {
        expect(keys.indexOf(covered)).toBeGreaterThan(index);
      }
    }
  });

  it('leaves holes without state paths unpatched and unmarked', () => {
    const source = `
      export default function App(props: { title: string }) {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return (
          <main>
            <h1>{props.title}</h1>
            {props.title === 'x' && <i>x</i>}
            <button on:click={bump}>{n}</button>
          </main>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.server).not.toContain('<!--t0-->');
    expect(result.server).not.toContain('<!--c1:');
    expect(result.manifest.groups).toEqual({
      n: { paths: ['n'], chunk: 'binding=n', bindings: ['t2'], covers: [] },
    });
  });

  it('escapes static text and attributes', () => {
    const source = `
      export default function App() {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return (
          <p title='say "hi" & bye' on:click={bump}>
            x & y {n}
          </p>
        );
      }
    `;
    const result = generateSource(source);
    const html = runServer(result.server, {});
    expect(html).toContain('title="say &quot;hi&quot; &amp; bye"');
    expect(html).toContain('x &amp; y');
  });
});

describe('entities', () => {
  it('escapes decoded text and attributes exactly once', () => {
    const source = `
      export default function App() {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return (
          <p title="a &lt; &quot;b&quot; &amp; c" on:click={bump}>
            x &lt; y &amp;amp; {n}
          </p>
        );
      }
    `;
    const html = runServer(generateSource(source).server, {});
    expect(html).toContain('title="a < &quot;b&quot; &amp; c"');
    expect(html).toContain('x &lt; y &amp;amp; ');
  });
});

describe('client chunks', () => {
  const SOURCE = `
    import { For } from 'idlip';
    export default function App(props: { min: number }) {
      let n = 0;
      let items = ['a', 'b'];
      function bump() {
        n = n + 1;
      }
      return (
        <main>
          {n > props.min ? <b class={{ big: n > 5 }}>{n}</b> : <i>low</i>}
          <ul>
            {n > 0 && <For each={items} key="id">{(item, index) => <li>{index}: {item} {n}</li>}</For>}
          </ul>
          <button on:click={bump}>+</button>
        </main>
      );
    }
  `;

  it('renders a condition branch with its own bindings and the scope it reads', () => {
    const result = generateSource(SOURCE.replace(' key="id"', ' key="item"'));
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const chunk = result.client.find((module) => module.chunk === 'binding=n');
    expect(chunk?.code).toContain('function renderC0(branch, { model }) {');
    expect(chunk?.code).toContain('(branch) => renderC0(branch, { model })');
    expect(chunk?.code).toContain('<!--t');
    // The branch reads `props.min` only in the test, so the chunk takes `props` for it.
    expect(chunk?.code).toMatch(/export function c0\(start, \{ model, props \}\)/);
    expect(result.server).toContain('props: { min: props.min }');
  });

  it('declares the loop variables a template reads and renders rows', () => {
    const result = generateSource(SOURCE.replace(' key="id"', ' key="item"'));
    const list = result.client.find((module) => module.chunk.startsWith('list='));
    expect(list?.code).toContain('const index = rows[0].index;');
    expect(list?.code).toContain('const item = rows[0].item;');
    const exports = runChunk(list?.code ?? '', { attr$: attr, on$: on, text$: text });
    const html = renderRow(exports, {
      model: { n: 3 },
      props: {},
      rows: [{ item: 'a', index: 1 }],
    });
    expect(html).toMatch(
      /^<li><!--t\d-->1<!--\/t-->: <!--t\d-->a<!--\/t--> <!--t\d-->3<!--\/t--><\/li>$/,
    );
  });

  it('sets the namespace of a list inside svg', () => {
    const source = `
      import { For } from 'idlip';
      export default function App() {
        let xs = [1, 2];
        function add() {
          xs = [...xs, 3];
        }
        return (
          <svg>
            <For each={xs} key="x">{(x) => <circle r={x} />}</For>
            <text on:click={add}>+</text>
          </svg>
        );
      }
    `;
    const result = generateSource(source);
    const list = result.client.find((module) => module.chunk.startsWith('list='));
    expect(list?.code).toContain("export const namespace = 'svg';");
  });

  it('nests lists: the inner list is a row binding of the outer list', () => {
    const source = `
      import { For } from 'idlip';
      export default function App() {
        let columns = [{ id: 'a', cards: [{ id: 'x', title: 't' }] }];
        function add() {
          columns = [];
        }
        return (
          <main on:click={add}>
            <For each={columns} key="id">
              {(column) => (
                <section>
                  <For each={column.cards} key="id">{(card) => <p>{card.title}</p>}</For>
                </section>
              )}
            </For>
          </main>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics).toEqual([]);
    const lists = result.manifest.lists;
    expect(lists['0']).toEqual({ key: 'id', path: 'columns', chunk: 'list=0', bindings: ['l1'] });
    expect(lists['1']).toEqual({
      key: 'id',
      path: 'columns.*.cards',
      chunk: 'list=1',
      bindings: ['t2'],
      parent: '0',
    });
    const group = result.manifest.groups['columns.*.cards'];
    expect(group.covers).toEqual(['columns']);
  });

  it('exports the list binding from a chunk that holds a row binding', () => {
    const source = `
      import { For } from 'idlip';
      export default function App() {
        let todos = [{ id: 'a' }];
        let selected = 'a';
        function pick() {
          selected = 'b';
        }
        return (
          <ul on:click={pick}>
            <For each={todos} key="id">{(t) => <li class={selected === t.id}>x</li>}</For>
          </ul>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const list = result.client.find((module) => module.chunk === 'list=0');
    expect(list).toBeDefined();
    const chunk = result.client.find((module) => module.chunk.includes('selected'));
    expect(chunk?.code).toMatch(/export function a\d+\(/);
    expect(chunk?.code).toMatch(/export function l\d+\(/);
  });

  it('exports every enclosing list binding from a chunk that holds a nested row binding', () => {
    const source = NESTED;
    const result = generateSource(source);
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const chunk = result.client.find((module) => module.chunk.includes('selected'));
    // The inner list is l1 and the outer list is l0, each exported once.
    expect(listExports(chunk?.code ?? '')).toEqual(['l0', 'l1']);
    expect(result.manifest.lists['1'].parent).toBe('0');
  });

  it('exports the same list code as the chunk that owns the list', () => {
    const result = generateSource(NESTED);
    const chunk = result.client.find((module) => module.chunk.includes('selected'));
    const outer = result.client.find((module) => module.chunk === 'binding=columns');
    const inner = result.client.find((module) => module.chunk === 'binding=columns.*.cards');
    expect(readFunction(chunk?.code ?? '', 'l0')).toBe(readFunction(outer?.code ?? '', 'l0'));
    expect(readFunction(chunk?.code ?? '', 'l1')).toBe(readFunction(inner?.code ?? '', 'l1'));
    expect(readFunction(chunk?.code ?? '', 'l0')).not.toBe('');
  });

  it('exports the lists of both lists when a row group spans two lists', () => {
    const source = `
      import { For } from 'idlip';
      export default function App() {
        let xs = [{ id: 1 }];
        let ys = [{ id: 2 }];
        let selected = 0;
        function pick() {
          selected = 1;
          xs = [];
          ys = [];
        }
        return (
          <div on:click={pick}>
            <For each={xs} key="id">{(x) => <i class={selected}>x</i>}</For>
            <For each={ys} key="id">{(y) => <b class={selected}>y</b>}</For>
          </div>
        );
      }
    `;
    const result = generateSource(source);
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    const chunk = result.client.find((module) => module.chunk === 'binding=selected');
    expect(listExports(chunk?.code ?? '')).toEqual(['l0', 'l2']);
  });

  it('does not export a list binding twice when the chunk already holds it', () => {
    const result = generateSource(NESTED);
    const chunk = result.client.find((module) => module.chunk === 'binding=columns.*.cards');
    expect(listExports(chunk?.code ?? '')).toEqual(['l0', 'l1']);
  });

  it('reports blocks that are not generated yet', () => {
    const source = `
      import { Try } from 'idlip';
      export default function App() {
        let n = 0;
        function bump() {
          n = n + 1;
        }
        return (
          <Try catch={(error) => <p>failed</p>}>
            <button on:click={bump}>{n}</button>
          </Try>
        );
      }
    `;
    const result = generateSource(source);
    const rules = result.diagnostics.map((diagnostic) => diagnostic.rule);
    expect(rules).toContain('codegen-unsupported');
    expect(result.server).toBe('');
    expect(result.client).toEqual([]);
  });

  it('passes the analysis errors through and emits nothing', () => {
    const result = generateSource('export default function App() { var x = 1; return <p />; }');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.server).toBe('');
  });
});

describe('manifest', () => {
  it('lists continuation tags of an async handler', () => {
    const source = `
      import { saveTodos } from './api.ts';
      export default function App() {
        let n = 0;
        async function save() {
          const result = await saveTodos(n);
          n = result;
        }
        return <button on:click={save}>{n}</button>;
      }
    `;
    const ir: ModuleIR = analyze('test.idlip.tsx', source);
    const component: Component = ir.components[0];
    const result = generate(ir, source, '/src/test.idlip.tsx');
    for (const segment of component.handlers[0].segments) {
      expect(result.manifest.handlers[segment.tag]).toEqual({ chunk: `handler=${segment.tag}` });
    }
  });

  it('sorts groups so a group comes before the groups it covers', () => {
    const { result } = generateFixture('todo');
    expect(Object.keys(result.manifest.groups)).toEqual([
      'todos.*.done',
      'todos.*.id',
      'todos.*.text',
      'draft',
      'todos',
    ]);
  });

  it('keeps the model type', () => {
    const model: Model = {};
    expect(model).toEqual({});
  });
});

describe('planGroups', () => {
  it('puts a group before the group it covers, even when that one has a longer path', () => {
    function bind(id: number, paths: string[]): Binding {
      return {
        id,
        kind: 't',
        name: `t${id}`,
        paths,
        frames: [],
        list: undefined,
        source: {
          kind: 'text',
          hole: { id, expr: { kind: 'literal', value: 1 }, paths: [], span: { start: 0, end: 0 } },
        },
      };
    }
    const groups = planGroups([bind(0, ['a.b', 'c.d.e']), bind(1, ['a.b'])]);
    expect(groups.map((group) => group.key)).toEqual(['a.b', 'a.b,c.d.e']);
    expect(groups[0].covers).toEqual(['a.b,c.d.e']);
  });
});
