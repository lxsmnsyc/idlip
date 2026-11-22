import { runInThisContext } from 'node:vm';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze, printModule } from '../../../../src/compiler/view/analyze/index.ts';
import { generate } from '../../../../src/compiler/view/codegen/index.ts';

function build(key: string, body = '<li>{item.label}</li>', extra = ''): string {
  return `
    import { For } from 'idlip';
    export default function App() {
      let items = [{ id: 1, kind: 'a', label: 'A', meta: { id: 'm' } }];
      return (
        <ul>
          <For each={items} key={${key}}>{(item) => ${body}}</For>
        </ul>
      );
    }
    ${extra}
  `;
}

function compile(source: string): ReturnType<typeof generate> & { errors: string[] } {
  const ir = analyze('test.tsx', source);
  const errors: string[] = [];
  for (const item of ir.diagnostics) {
    if (item.severity === 'error') {
      errors.push(`${item.rule}: ${item.message}`);
    }
  }
  return { ...generate(ir, source, '/src/test.tsx'), errors };
}

function readListChunk(code: string): Record<string, unknown> {
  const body = code
    .replaceAll(/^import .*$/gm, '')
    .replaceAll('export const', 'const')
    .replaceAll('export function', 'function');
  const value: unknown = runInThisContext(`(function () {\n${body}\nreturn { key };\n})`);
  if (typeof value !== 'function') {
    throw new TypeError('not a function');
  }
  const out: unknown = Reflect.apply(value, undefined, []);
  if (typeof out !== 'object' || out === null) {
    throw new TypeError('no exports');
  }
  return Object.fromEntries(Object.entries(out));
}

describe('<For> key', () => {
  it('names a field of the item in the manifest', () => {
    const result = compile(build('(item) => item.id'));
    expect(result.errors).toEqual([]);
    expect(result.manifest.lists['0'].key).toBe('id');
    const list = result.client.find((module) => module.chunk.startsWith('list='));
    expect(list?.code).not.toContain('export function key');
  });

  it('names the field whatever the callback names the item', () => {
    const result = compile(build('(t) => t.id'));
    expect(result.errors).toEqual([]);
    expect(result.manifest.lists['0'].key).toBe('id');
  });

  it('leaves a template literal to the list chunk', () => {
    const result = compile(build('(t) => `${t.kind}:${t.id}`'));
    expect(result.errors).toEqual([]);
    expect(result.manifest.lists['0'].key).toBeUndefined();
    expect(result.manifest.lists['0'].path).toBe('items');
    const list = result.client.find((module) => module.chunk.startsWith('list='));
    expect(list?.code).toContain('export function key(');
  });

  it('leaves a nested field to the list chunk', () => {
    const result = compile(build('(t) => t.meta.id'));
    expect(result.errors).toEqual([]);
    expect(result.manifest.lists['0'].key).toBeUndefined();
  });

  it('prints a computed key in the recorded IR', () => {
    const source = build('(t) => `${t.kind}:${t.id}`');
    expect(printModule(analyze('test.tsx', source), source)).toContain('key={');
  });

  it('gives the list chunk the same key as the source arrow for any item', () => {
    const result = compile(build('(t) => `${t.kind}:${t.meta.id}:${t.id + 1}`'));
    const list = result.client.find((module) => module.chunk.startsWith('list='));
    const { key } = readListChunk(list?.code ?? '');
    if (typeof key !== 'function') {
      throw new TypeError('no key export');
    }
    fc.assert(
      fc.property(
        fc.record({
          kind: fc.string(),
          id: fc.integer(),
          meta: fc.record({ id: fc.string() }),
        }),
        (item) => {
          expect(Reflect.apply(key, undefined, [item])).toBe(
            `${item.kind}:${item.meta.id}:${item.id + 1}`,
          );
        },
      ),
    );
  });

  it('writes the same expression into the server slot of a child row', () => {
    const source = build(
      '(t) => `${t.kind}:${t.id}`',
      '<Row label={item.label} />',
      `function Row(props: { label: string }) {
        let n = 0;
        function inc() { n = n + 1; }
        return <button on:click={inc}>{props.label}{n}</button>;
      }`,
    );
    const result = compile(source);
    expect(result.errors).toEqual([]);
    expect(result.server).toContain('slot$(');
    expect(result.server).toMatch(
      /slot\$\([^)]*\$\{item\.kind\}:\$\{item\.id\}|item\.kind \+ ':' \+ item\.id/,
    );
  });

  it('reports the string form with the callback to write', () => {
    const result = compile(build('"id"').replace('key={"id"}', 'key="id"'));
    expect(result.errors).toEqual([
      expect.stringContaining('for-key: <For> takes key as a callback of the item'),
    ]);
    expect(result.errors[0]).toContain('key="id" is gone: write key={(item) => item.id}');
  });

  it('reports a key without a callback, a block body and two parameters', () => {
    for (const key of ['5', '(t) => { return t.id; }', '(t, i) => t.id', '({ id }) => id']) {
      expect(compile(build(key)).errors.join()).toContain('for-key');
    }
  });

  it('reports a key that reads state, the index or a call', () => {
    const state = build('(t) => t.id + count').replace('let items', 'let count = 1;\n let items');
    expect(compile(state).errors.join()).toContain('for-key');
    expect(
      compile(
        build('(t) => t.id', '<li>{item.label}</li>').replace('(t) => t.id', '(t) => [t.id]'),
      ).errors.join(),
    ).toContain('for-key');
  });
});
