import { describe, expect, it } from 'vitest';
import { compileHandlers } from '../../../src/compiler/update/index.ts';

const HEAD = `import type { JSX } from 'idlip/jsx-runtime';\n`;

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

describe('scope', () => {
  it('leaves a parameter or local named like a prop alone', () => {
    const { code } = compile(`${HEAD}
export default function A(props: { start: number; list: number[] }): JSX.Element {
  let count = 0;
  function set(start: number) {
    count = start;
  }
  function sum() {
    const start = 2;
    count = start + props.list.length + [1].map((props) => props + 1).length;
  }
  return <button on:click={() => set(1)}>{count}</button>;
}
`);
    expect(code['handler=set']).toBe(`export function set(model, [start]) {
  let { count } = model;
  count = start;
  return { ...model, count };
}
`);
    expect(code['handler=sum']).toContain(
      'count = start + props$list$length + [1].map((props) => props + 1).length;',
    );
    expect(code['handler=sum']).toContain('[props$list$length]');
  });

  it('does not treat a shadowing name in a derived value as a props read', () => {
    const { rules } = compile(`${HEAD}
export default function A(props: { n: number }): JSX.Element {
  let x = 0;
  const doubled = [1].map((props) => props * 2);
  function set() {
    x = doubled[0];
  }
  return <button on:click={set}>{x}</button>;
}
`);
    expect(rules).toEqual([]);
  });
});

describe('returns, recursion and payload', () => {
  const source = `${HEAD}
export default function A(props: { k: number }): JSX.Element {
  let n = 0;
  function inc() {
    n = n + 1;
    return n;
  }
  function twice() {
    inc();
    return inc();
  }
  function down(left: number) {
    if (left > 0) {
      n = n + props.k;
      down(left - 1);
    }
  }
  function sum(...xs: number[]) {
    n = xs.length + props.k;
  }
  return <button on:click={twice}>{n}</button>;
}
`;

  it('keeps the value of a return in the entry', () => {
    const { code } = compile(source);
    expect(code['handler=twice']).toBe(`export function twice(model) {
  let { n } = model;
  function inc() {
    n = n + 1;
    return n;
  }
  inc();
  { inc(); return { ...model, n }; }
}
`);
  });

  it('nests a recursive handler so the call reaches the nested function', () => {
    const { code } = compile(source);
    expect(code['handler=down']).toBe(`export function down(model, [props$k, ...$args]) {
  let { n } = model;
  function down(left) {
    if (left > 0) {
      n = n + props$k;
      down(left - 1);
    }
  }
  down(...$args);
  return { ...model, n };
}
`);
  });

  it('puts props first so a rest parameter stays last', () => {
    const { code } = compile(source);
    expect(code['handler=sum']).toContain('export function sum(model, [props$k, ...xs]) {');
  });
});

describe('derived values after a write', () => {
  function build(lines: string): string {
    return `${HEAD}
export default function A(): JSX.Element {
  let n = 0;
  const big = n > 3;
  let flag = false;
  function go() {
${lines}
  }
  return <button on:click={go}>{flag}</button>;
}
`;
  }

  it('warns when the value is read after a write it depends on', () => {
    expect(compile(build('    n = 9;\n    flag = big;')).rules).toEqual(['handler-derived-stale']);
  });

  it('is quiet when the value is read before the write', () => {
    expect(compile(build('    flag = big;\n    n = 9;')).rules).toEqual([]);
  });
});

describe('more errors', () => {
  it('rejects a helper that assigns a module-level let', () => {
    const { code, rules } = compile(`${HEAD}
let calls = 0;
function bump(): number {
  calls = calls + 1;
  return calls;
}
export default function A(): JSX.Element {
  let n = 0;
  function go() {
    n = bump();
  }
  return <button on:click={go}>{n}</button>;
}
`);
    expect(rules).toEqual(['helper-module-state']);
    expect(code).toEqual({});
  });

  it('rejects a return inside a try block with a finally', () => {
    const { code, rules } = compile(`${HEAD}
export default function A(): JSX.Element {
  let n = 0;
  function go() {
    try {
      return;
    } finally {
      n = 1;
    }
  }
  return <button on:click={go}>{n}</button>;
}
`);
    expect(rules).toEqual(['handler-return-finally']);
    expect(code).toEqual({});
  });
});
