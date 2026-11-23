// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { format } from 'oxfmt';
import * as runtime from '../../../src/core/helpers.ts';
import { describe, expect, it, vi } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { getChunkFile } from '../../../src/core/format.ts';
import { attr, createContext, on, text } from '../../fixtures/reference.ts';
import { printRow } from '../../fixtures/rows.ts';

// Compiled server modules import the render helpers from the package.
vi.mock('idlip/server', async () => import('../../fixtures/reference.ts'));

const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures');

function readFixture(name: string, ...parts: string[]): string {
  return readFileSync(join(FIXTURES, name, ...parts), 'utf8');
}

/** Formats JS as the repo does, so only the code is compared. */
async function normalize(code: string): Promise<string> {
  const result = await format('chunk.js', code, { singleQuote: true });
  return result.code;
}

/** Evaluates the `manifest` and `chunks` constants of a server module. */
function readConsts(code: string): unknown {
  const start = code.indexOf('export const manifest');
  const end = code.indexOf('export default');
  const body = code.slice(start, end).replaceAll('export const', 'const');
  return runInThisContext(`(function () {\n${body}\nreturn { manifest, chunks };\n})()`);
}

/** Strips the module syntax of generated code, so it can run as a function body. */
function stripModule(code: string): string {
  return code
    .replaceAll(/^import .*$/gm, '')
    .replace('export default function', 'function')
    .replaceAll('export const', 'const')
    .replaceAll('export function', 'function');
}

function evaluate(globals: Record<string, unknown>, body: string): unknown {
  const factory: unknown = runInThisContext(
    `(function (${Object.keys(globals).join(', ')}) {\n${body}\n})`,
  );
  if (typeof factory !== 'function') {
    throw new TypeError('The code is not a function');
  }
  return Reflect.apply(factory, undefined, Object.values(globals));
}

type Render = (props: unknown, context: unknown) => string;

function isRender(value: unknown): value is Render {
  return typeof value === 'function';
}

/** Runs a list chunk with the given helpers and returns its `render` export. */
function loadRender(code: string, helpers: Record<string, unknown>): Render {
  const exports = evaluate(helpers, `${stripModule(code)}\nreturn { render };`);
  if (typeof exports === 'object' && exports !== null && 'render' in exports) {
    const render: unknown = exports.render;
    if (isRender(render)) {
      return render;
    }
  }
  throw new TypeError('The chunk has no render export');
}

/** Renders the server module with the reference helpers and appends the state script. */
function runServer(code: string, props: unknown): string {
  const body = stripModule(code);
  const name = /function (\w+)\(props, context, model\)/.exec(body)?.[1] ?? '';
  const render = evaluate({ text$: text, attr$: attr, on$: on }, `${body}\nreturn ${name};`);
  if (!isRender(render)) {
    throw new TypeError('The server module has no render function');
  }
  const { context, writeState } = createContext();
  return render(props, context) + writeState();
}

function readProps(name: string): unknown {
  const input: unknown = JSON.parse(readFixture(name, 'input.json'));
  if (typeof input === 'object' && input !== null && 'props' in input) {
    return input.props;
  }
  throw new TypeError(`The ${name} input has no props`);
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

describe.each(['counter', 'todo'])('compile() on the %s fixture', (name) => {
  const source = readFixture(name, `${name}.tsx`);
  const result = compile(source, readId(name));

  it('reports no diagnostics', () => {
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
    for (const module of result.client) {
      actual.push(getChunkFile(module.chunk));
    }
    const expected = readdirSync(join(FIXTURES, name, 'expected', 'client'));
    expect(actual.toSorted()).toEqual(expected.toSorted());
  });

  it('emits the golden handler and binding chunks', async () => {
    for (const module of result.client) {
      // List chunks are checked by behavior below.
      if (module.chunk.startsWith('list=')) {
        continue;
      }
      const expected = readFixture(name, 'expected', 'client', getChunkFile(module.chunk));
      expect(await normalize(module.code)).toBe(await normalize(expected));
    }
  });
});

/** The todo row as the server writes it, from the reference render helpers. */
function renderServerRow(item: { id: string; text: string; done: boolean }): string {
  return `<li${attr('class', { done: item.done })} i-a="4"><input type="checkbox"${attr('checked', item.done)} on:click="$e3" i-a="5"><!--t6-->${text(item.text)}<!--/t--></li>`;
}

describe('compile() behavior', () => {
  it.each(['counter', 'todo'])('renders the %s fixture page', (name) => {
    const result = compile(readFixture(name, `${name}.tsx`), readId(name));
    const page = readFixture(name, 'expected', 'page.html');
    expect(runServer(result.server, readProps(name))).toBe(page.trimEnd());
  });

  it('renders the todo rows the server writes, as the fixture list chunk does', () => {
    const result = compile(readFixture('todo', 'todo.tsx'), readId('todo'));
    const chunk = result.client.find((module) => module.chunk === 'list=3');
    const actual = loadRender(chunk?.code ?? '', runtime);
    const expected = loadRender(readFixture('todo', 'expected', 'client', 'list.3.js'), runtime);
    const items = [
      { id: 'a1', text: 'one & two', done: true },
      { id: 'a2', text: '<b>', done: false },
    ];
    for (const item of items) {
      const scope = { model: {}, props: {}, rows: [{ item, index: 0 }] };
      const row = printRow(actual(scope, document));
      expect(row).toBe(printRow(expected(scope, document)));
      expect(row).toBe(printRow(renderServerRow(item)));
    }
  });
});

describe('compile() diagnostics', () => {
  it('returns no output and a positioned error', () => {
    const source = 'export default function A(props) {\n  return <div {...props} />;\n}\n';
    const result = compile(source, '/src/a.tsx');
    const errors = result.diagnostics.filter((item) => item.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(result.server).toBe('');
    expect(result.client).toEqual([]);
    expect(result.manifest.handlers).toEqual({});
    for (const error of errors) {
      expect(error.span.end).toBeGreaterThan(error.span.start);
      expect(error.span.end).toBeLessThanOrEqual(source.length);
    }
  });
});
