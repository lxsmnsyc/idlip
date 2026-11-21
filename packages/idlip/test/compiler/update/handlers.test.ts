import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChunkFile } from '../../../src/core/format.ts';
import { analyze } from '../../../src/compiler/view/analyze/index.ts';
import { compileHandlers } from '../../../src/compiler/update/index.ts';

const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name, `${name}.idlip.tsx`), 'utf8');
}

/** Compiles a source and returns the code of each chunk by name. */
function compile(source: string): { code: Record<string, string>; rules: string[] } {
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

describe('golden fixtures', () => {
  for (const name of ['counter', 'todo']) {
    it(`emits the expected handler chunks of ${name}`, () => {
      const result = compileHandlers(`/src/${name}.idlip.tsx`, readFixture(name));
      expect(result.diagnostics).toEqual([]);
      const dir = join(FIXTURES, name, 'expected', 'client');
      const expected: string[] = [];
      for (const file of readdirSync(dir)) {
        if (file.startsWith('handler.')) {
          expected.push(file);
        }
      }
      const emitted: string[] = [];
      for (const module of result.client) {
        const file = getChunkFile(module.chunk);
        emitted.push(file);
        expect(module.code, file).toBe(readFileSync(join(dir, file), 'utf8'));
      }
      expect(emitted.toSorted()).toEqual(expected.toSorted());
    });
  }
});

const HEAD = `import type { JSX } from 'idlip/jsx-runtime';\n`;

describe('helpers and imports', () => {
  const source = `${HEAD}
import { format } from './format.ts';
import { unused } from './unused.ts';

interface Row {
  id: string;
}

const PREFIX = 'row-';
function label(row: Row): string {
  return PREFIX + format(row.id);
}
function ignored(): number {
  return unused();
}

export default function App(props: { rows: Row[] }): JSX.Element {
  let picked = '';
  let other = 0;
  function pick(row: Row) {
    picked = label(row);
  }
  function bump() {
    other = other + 1;
  }
  return (
    <div>
      <button on:click={() => pick(props.rows[0])}>pick</button>
      <button on:click={bump}>{picked}{other}</button>
    </div>
  );
}
`;

  it('copies a helper the handler reaches, with what the helper reaches', () => {
    const { code } = compile(source);
    expect(code['handler=pick']).toBe(`import { format } from './format.ts';

const PREFIX = 'row-';
function label(row) {
  return PREFIX + format(row.id);
}

export function pick(model, [row]) {
  let { picked } = model;
  picked = label(row);
  return { ...model, picked };
}
`);
  });

  it('leaves out helpers and imports the handler does not reach', () => {
    const { code } = compile(source);
    expect(code['handler=bump']).toBe(`export function bump(model) {
  let { other } = model;
  other = other + 1;
  return { ...model, other };
}
`);
    expect(code['handler=bump']).not.toContain('unused');
  });
});

describe('props and handler calls', () => {
  const source = `${HEAD}
export default function Counter(props: { step: number; label: { text: string } }): JSX.Element {
  let count = 0;
  let note = '';
  function add(by: number) {
    count = count + by * props.step;
  }
  function addTwice(by: number) {
    add(by);
    add(by);
    note = props.label.text;
  }
  return <button on:click={() => addTwice(1)}>{count}{note}</button>;
}
`;

  it('reads a prop as a payload field before the arguments', () => {
    const { code } = compile(source);
    expect(code['handler=add']).toBe(`export function add(model, [props$step, by]) {
  let { count } = model;
  count = count + by * props$step;
  return { ...model, count };
}
`);
  });

  it('runs a called handler inline in one chunk', () => {
    const { code } = compile(source);
    expect(code['handler=addTwice'])
      .toBe(`export function addTwice(model, [props$label$text, props$step, by]) {
  let { count, note } = model;
  function add(by) {
    count = count + by * props$step;
  }
  add(by);
  add(by);
  note = props$label$text;
  return { ...model, count, note };
}
`);
  });

  it('reads a destructured prop as a payload field', () => {
    const { code } = compile(`${HEAD}
export default function Box({ start, user }: { start: number; user: { name: string } }): JSX.Element {
  let value = 0;
  function reset() {
    value = start + user.name.length;
  }
  return <button on:click={reset}>{value}</button>;
}
`);
    expect(code['handler=reset'])
      .toBe(`export function reset(model, [props$start, props$user$name$length]) {
  let { value } = model;
  value = props$start + props$user$name$length;
  return { ...model, value };
}
`);
  });
});

describe('derived values and returns', () => {
  const source = `${HEAD}
export default function List(props: { seed: number }): JSX.Element {
  let items: string[] = [];
  let busy = false;
  const total = items.length;
  function add(text: string) {
    if (busy) {
      return;
    }
    if (total > 3) return;
    items = [...items, text!];
    busy = (true as boolean);
  }
  function check() {
    busy = total > 0;
  }
  return <button on:click={() => add('a')}>{total}</button>;
}
`;

  it('computes a derived value the handler reads from the entry model', () => {
    const { code } = compile(source);
    expect(code['handler=check']).toBe(`export function check(model) {
  let { items, busy } = model;
  const total = items.length;
  busy = total > 0;
  return { ...model, busy };
}
`);
  });

  it('returns the next model from every return and strips types', () => {
    const { code, rules } = compile(source);
    expect(code['handler=add']).toBe(`export function add(model, [text]) {
  let { items, busy } = model;
  const total = items.length;
  if (busy) {
    return { ...model, items, busy };
  }
  if (total > 3) return { ...model, items, busy };
  items = [...items, text];
  busy = (true);
  return { ...model, items, busy };
}
`);
    expect(rules).toEqual([]);
  });
});

describe('errors', () => {
  it('rejects an await', () => {
    const { code, rules } = compile(`${HEAD}
import { save } from './save.ts';
export default function A(): JSX.Element {
  let done = false;
  async function run() {
    await save();
    done = true;
  }
  return <button on:click={run}>{done}</button>;
}
`);
    expect(rules).toContain('handler-await');
    expect(code).toEqual({});
  });

  it('rejects a change in place', () => {
    const { code, rules } = compile(`${HEAD}
export default function A(): JSX.Element {
  let items: string[] = [];
  function add(text: string) {
    items.push(text);
  }
  return <button on:click={() => add('a')}>{items.length}</button>;
}
`);
    expect(rules).toEqual(['handler-mutate']);
    expect(code).toEqual({});
  });

  it('rejects a derived value that reads props', () => {
    const { rules } = compile(`${HEAD}
export default function A(props: { n: number }): JSX.Element {
  let x = 0;
  const doubled = props.n * 2;
  function set() {
    x = doubled;
  }
  return <button on:click={set}>{x}</button>;
}
`);
    expect(rules).toContain('handler-derived-props');
  });
});

describe('method calls on props paths', () => {
  const source = `${HEAD}
export default function Finder(props: { list: string[] }): JSX.Element {
  let at = -1;
  function find(by: string) {
    at = props.list.indexOf(by);
  }
  return <button on:click={() => find('b')}>{at}</button>;
}
`;

  it('reads the receiver as the payload field and keeps the argument', () => {
    const { code, rules } = compile(source);
    expect(rules).toEqual([]);
    expect(code['handler=find']).toContain('export function find(model, [props$list, by]) {');
    expect(code['handler=find']).toContain('props$list.indexOf(by)');
  });

  it('reports a props path the IR does not list instead of appending it', () => {
    const ir = analyze('/src/test.idlip.tsx', source);
    for (const entry of ir.components[0].handlers[0].free) {
      entry.paths = [];
    }
    const result = compileHandlers('/src/test.idlip.tsx', source, ir);
    expect(result.client).toEqual([]);
    const rules: string[] = [];
    for (const diagnostic of result.diagnostics) {
      rules.push(diagnostic.rule);
    }
    expect(rules).toEqual(['handler-props-unlisted']);
  });
});
