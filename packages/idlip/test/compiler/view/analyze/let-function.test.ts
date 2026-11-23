import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';

function compileBody(body: string): ReturnType<typeof compile> {
  const source = `export default function A() {\n${body}\n  return <button on:click={go}>{String(n)}</button>;\n}\n`;
  return compile(source, '/src/a.tsx');
}

function listRules(body: string): string[] {
  return compileBody(body).diagnostics.map((item) => item.rule);
}

describe('let-function', () => {
  it.each([
    ['an arrow', 'let n = 0;\n  let onDone = () => {};\n  function go() { n = 1; onDone = n; }'],
    [
      'a function expression',
      'let n = 0;\n  let onDone = function () {};\n  function go() { n = 1; onDone = n; }',
    ],
    [
      'an async arrow',
      'let n = 0;\n  let onDone = async () => 1;\n  function go() { n = 1; onDone = n; }',
    ],
    [
      'an arrow under satisfies',
      'let n = 0;\n  let onDone = (() => 1) satisfies () => number as () => number;\n  function go() { n = 1; onDone = n; }',
    ],
  ])('rejects %s as an initial value', (_name, body) => {
    const result = compileBody(body);
    const found = result.diagnostics.filter((item) => item.rule === 'let-function');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('function declaration');
    expect(found[0].span.start).toBeLessThan(found[0].span.end);
    expect(result.client).toEqual([]);
  });

  it('points at the function', () => {
    const body = 'let n = 0;\n  let onDone = () => {};\n  function go() { n = 1; onDone = n; }';
    const source = `export default function A() {\n${body}\n  return <button on:click={go}>{String(n)}</button>;\n}\n`;
    const [found] = compile(source, '/src/a.tsx').diagnostics.filter(
      (item) => item.rule === 'let-function',
    );
    expect(source.slice(found.span.start, found.span.end)).toBe('() => {}');
  });

  it.each([
    ['an arrow', 'n = () => 1;'],
    ['a function expression', 'n = function () {};'],
    ['an arrow under as', 'n = (() => 1) as unknown as number;'],
  ])('rejects %s assigned in a handler', (_name, statement) => {
    const result = compileBody(`let n = 0;\n  function go() { ${statement} }`);
    const found = result.diagnostics.filter((item) => item.rule === 'let-function');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('function declaration');
    expect(result.client).toEqual([]);
  });

  it('keeps a function in a handler local and a call of one', () => {
    const rules = listRules(
      'let n = 0;\n  function go() { const add = (x: number) => x + 1; n = add(n); }',
    );
    expect(rules).toEqual([]);
  });

  it('still reports a closure in a hole as hole-closure', () => {
    const result = compile(
      'export default function A() {\n  let n = 0;\n  function go() { n = 1; }\n  return <button on:click={go}>{(() => 1)()}</button>;\n}\n',
      '/src/a.tsx',
    );
    expect(result.diagnostics.map((item) => item.rule)).not.toContain('let-function');
  });
});
