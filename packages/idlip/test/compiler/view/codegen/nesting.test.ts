// @vitest-environment happy-dom
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { format } from 'oxfmt';
import { describe, expect, it } from 'vitest';
import { compileHandlers } from '../../../../src/compiler/update/index.ts';
import { analyze } from '../../../../src/compiler/view/analyze/index.ts';
import { generate } from '../../../../src/compiler/view/codegen/index.ts';
import type { GenerateResult } from '../../../../src/compiler/view/codegen/index.ts';
import { getChunkFile } from '../../../../src/core/format.ts';
import { render } from '../../../../src/server/render.ts';
import { clone$, putText$, setOn$ } from '../../../../src/core/helpers.ts';
import { createContext, on, slot, text } from '../../../fixtures/reference.ts';
import { printRow } from '../../../fixtures/rows.ts';

const NESTED = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'nested');

/** The fixture sources import the child as a sibling, and the ids say it is in `/src`. */
const RESOLVED: Record<string, string> = {
  '../counter/counter.tsx': '/src/counter.tsx',
};

function readFixture(name: string, ...parts: string[]): string {
  return readFileSync(join(NESTED, name, ...parts), 'utf8');
}

function readId(name: string): string {
  const input: unknown = JSON.parse(readFixture(name, 'input.json'));
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    typeof input.id === 'string'
  ) {
    return input.id;
  }
  throw new TypeError(`The ${name} input has no id`);
}

function readProps(name: string): unknown {
  const input: unknown = JSON.parse(readFixture(name, 'input.json'));
  if (typeof input === 'object' && input !== null && 'props' in input) {
    return input.props;
  }
  throw new TypeError(`The ${name} input has no props`);
}

interface Compiled extends GenerateResult {
  /** Handler chunks, then view chunks. */
  chunks: { chunk: string; code: string }[];
}

/** Compiles as `compile()` does, with the options that `vite-plugin` passes for a child. */
function compileFixture(name: string, child: boolean): Compiled {
  const id = readId(name);
  const source = readFixture(name, `${name}.tsx`);
  const ir = analyze(id, source);
  const handlers = compileHandlers(id, source, ir);
  const view = generate(ir, source, id, {
    child,
    resolve: (specifier) => RESOLVED[specifier] ?? specifier,
  });
  return { ...view, chunks: [...handlers.client, ...view.client] };
}

async function normalize(code: string): Promise<string> {
  const result = await format('chunk.js', code, { singleQuote: true });
  return result.code;
}

function readConsts(code: string): unknown {
  const start = code.indexOf('export const manifest');
  const end = code.indexOf('export default');
  const body = code
    .slice(start, end)
    .replaceAll('export const', 'const')
    .replace(/const uses = .*$/m, '');
  return runInThisContext(`(function () {\n${body}\nreturn { manifest, chunks };\n})()`);
}

function stripModule(code: string): string {
  return code
    .replaceAll(/^import .*$/gm, '')
    .replace('export default function', 'function')
    .replaceAll('export const', 'const')
    .replaceAll('export function', 'function');
}

function evaluate(globals: Record<string, unknown>, body: string): Record<string, unknown> {
  const factory: unknown = runInThisContext(
    `(function (${Object.keys(globals).join(', ')}) {\n${body}\n})`,
  );
  if (typeof factory !== 'function') {
    throw new TypeError('The code is not a function');
  }
  const result: unknown = Reflect.apply(factory, undefined, Object.values(globals));
  if (typeof result !== 'object' || result === null) {
    throw new TypeError('The code returned no exports');
  }
  return Object.fromEntries(Object.entries(result));
}

function call(exports: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const value = exports[name];
  if (typeof value !== 'function') {
    throw new TypeError(`No function ${name}`);
  }
  const result: unknown = Reflect.apply(value, undefined, args);
  return result;
}

/** Runs the chunk's code, whose imports the globals stand in for. */
function loadChunk(
  code: string,
  names: string[],
  globals: Record<string, unknown>,
): Record<string, unknown> {
  return evaluate(globals, `${stripModule(code)}\nreturn { ${names.join(', ')} };`);
}

function findChunk(result: Compiled, chunk: string): string {
  for (const module of result.chunks) {
    if (module.chunk === chunk) {
      return module.code;
    }
  }
  throw new Error(`No chunk ${chunk}`);
}

/** Renders a compiled server module with the reference helpers. */
function renderServer(
  code: string,
  globals: Record<string, unknown>,
  props: unknown,
  context: unknown,
): string {
  const body = stripModule(code);
  const name = /function (\w+)\(props, context, model/.exec(body)?.[1] ?? '';
  const exports = evaluate(
    { text$: text, on$: on, slot$: slot, ...globals },
    `${body}\nreturn { ${name} };`,
  );
  const markup = call(exports, name, props, context);
  if (typeof markup !== 'string') {
    throw new TypeError('The server module returned no markup');
  }
  return markup;
}

describe.each([
  ['counter', true],
  ['board', false],
] as const)('nested fixture %s', (fixture, child) => {
  const name: string = fixture;
  const result = compileFixture(name, child);

  it('reports no diagnostics, and no unsupported child', () => {
    expect(result.diagnostics).toEqual([]);
  });

  it('matches the golden manifest', () => {
    expect(result.manifest).toEqual(JSON.parse(readFixture(name, 'expected', 'manifest.json')));
  });

  it('has the manifest and chunk map of the golden server module', () => {
    expect(readConsts(result.server)).toEqual(
      readConsts(readFixture(name, 'expected', 'server.js')),
    );
  });

  it('emits the golden chunk files', () => {
    const actual: string[] = [];
    for (const module of result.chunks) {
      actual.push(getChunkFile(module.chunk));
    }
    const expected = readdirSync(join(NESTED, name, 'expected', 'client'));
    expect(actual.toSorted()).toEqual(expected.toSorted());
  });

  // `UPDATE_NESTED=1 pnpm vitest run test/compiler/view/codegen/nesting` writes the chunks again.
  if (process.env.UPDATE_NESTED === '1') {
    it('writes the golden chunks', () => {
      for (const module of result.chunks) {
        writeFileSync(
          join(NESTED, name, 'expected', 'client', getChunkFile(module.chunk)),
          module.code,
        );
      }
    });
  }

  it('emits the golden chunks, the item template and the view chunk included', async () => {
    for (const module of result.chunks) {
      const expected = readFixture(name, 'expected', 'client', getChunkFile(module.chunk));
      expect(await normalize(module.code), module.chunk).toBe(await normalize(expected));
    }
  });
});

/** The server module of the counter, as the board imports it. */
function loadCounter(): Record<string, unknown> {
  const counter = compileFixture('counter', true);
  const consts = readConsts(counter.server);
  const code = stripModule(counter.server);
  const exports = evaluate(
    { text$: text, on$: on, slot$: slot },
    `${code}\nreturn { default: Counter };`,
  );
  if (typeof consts !== 'object' || consts === null) {
    throw new TypeError('The counter has no constants');
  }
  return { ...consts, ...exports };
}

describe('nested behavior', () => {
  it('renders the counter page', () => {
    const counter = compileFixture('counter', true);
    const { context, writeState } = createContext();
    const html = renderServer(counter.server, {}, readProps('counter'), context) + writeState();
    expect(html).toBe(readFixture('counter', 'expected', 'page.html').trimEnd());
  });

  it('renders the board page with its children and slots', () => {
    const board = compileFixture('board', false);
    const { context, writeState } = createContext();
    const html =
      renderServer(board.server, { Counter: loadCounter() }, readProps('board'), context) +
      writeState();
    expect(html).toBe(readFixture('board', 'expected', 'page.html').trimEnd());
  });

  it('renders the board page through render() with slots, modules and the event union', async () => {
    const board = compileFixture('board', false);
    const body = stripModule(board.server);
    const exports = evaluate(
      { text$: text, on$: on, slot$: slot, Counter: loadCounter() },
      `${body}\nreturn { Board };`,
    );
    const html = await render(
      (props: unknown, ...rest: unknown[]) => call(exports, 'Board', props, ...rest),
      readProps('board'),
    );
    expect(html).toBe(readFixture('board', 'expected', 'page.html').trimEnd());
  });

  it('adds a child from the item template as the golden one does', () => {
    const board = compileFixture('board', false);
    const calls: unknown[][] = [];
    const globals = {
      addChild: (...args: unknown[]) => {
        calls.push(args.slice(0, 4));
        return document.createComment('child');
      },
      $init_Counter: undefined,
      $render_Counter: undefined,
      clone$,
      slot$: slot,
    };
    const actual = loadChunk(findChunk(board, 'list=2'), ['render'], globals);
    const golden = loadChunk(
      readFixture('board', 'expected', 'client', 'list.2.js'),
      ['render'],
      globals,
    );
    const item = { id: 'a/1', label: 'One' };
    const results: unknown[][][] = [];
    const rows: string[][] = [];
    for (const target of [actual, golden]) {
      calls.length = 0;
      const printed: string[] = [];
      for (const path of [undefined, '3']) {
        const scope = { model: {}, props: {}, rows: [{ item, index: 0 }], path };
        printed.push(printRow(call(target, 'render', scope, document)));
      }
      results.push(calls.map((args) => [...args]));
      rows.push(printed);
    }
    expect(results[0]).toEqual(results[1]);
    expect(rows[0]).toEqual(rows[1]);
    // The template holds the boundary comments, and the child's nodes go between them.
    expect(rows[0]).toEqual([
      '<!--n:1:a%2F1--><!--child--><!--/n-->',
      '<!--n:3/1:a%2F1--><!--child--><!--/n-->',
    ]);
    expect(results[0][0].slice(0, 2)).toEqual(['1:a%2F1', '/src/counter.tsx']);
    expect(results[0][1][0]).toBe('3/1:a%2F1');
    expect(results[0][1][3]).toEqual({ label: 'One', onRemove: ['remove', ['a/1'], '', '3'] });
  });

  it('renders the view chunk of the counter as the golden one does', () => {
    const counter = compileFixture('counter', true);
    const names = ['init', 'render'];
    const globals = { clone$, putText$, setOn$ };
    const actual = loadChunk(findChunk(counter, 'view'), names, globals);
    const golden = loadChunk(
      readFixture('counter', 'expected', 'client', 'view.js'),
      names,
      globals,
    );
    const props = { label: 'A & B', onRemove: ['clearAll', [], '', ''] as const };
    expect(call(actual, 'init', props)).toEqual({ count: 0 });
    const model = call(golden, 'init', props);
    const scope = { model, props, rows: [], path: '2' };
    const printed = printRow(call(actual, 'render', scope, document));
    expect(printed).toBe(printRow(call(golden, 'render', scope, document)));
    // The clone holds the nodes the server's HTML parses to.
    const server = `<div><span i-a="0">${text(props.label)}</span><button on:click='["increment",[]]'>+</button><output i-a="1">0</output><button${on('click', props.onRemove)} i-a="2">Remove</button></div>`;
    expect(printed).toBe(printRow(server));
  });
});
