import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../../src/compiler/view/analyze/index.ts';
import { pickComponent } from '../../../src/compiler/update/index.ts';
import { listWrites, meetsPath } from '../../../src/compiler/update/writes.ts';

const HEAD = `import type { JSX } from 'idlip/jsx-runtime';\n`;

function getWrites(source: string): Record<string, string[] | undefined> {
  const ir = analyze('/src/test.tsx', source);
  const component = pickComponent(ir)!;
  return Object.fromEntries(listWrites('/src/test.tsx', source, component));
}

describe('todo fixture', () => {
  const source = readFileSync(join(import.meta.dirname, '../../fixtures/todo/todo.tsx'), 'utf8');
  const writes = getWrites(source);

  it('gives the field of a single assignment', () => {
    expect(writes.setDraft).toEqual(['draft']);
    expect(writes.clear).toEqual(['draft']);
  });

  it('gives the item field of the map pattern', () => {
    expect(writes.toggle).toEqual(['todos.*.done']);
  });

  it('gives every written field in source order', () => {
    expect(writes.add).toEqual(['todos', 'next', 'draft']);
  });
});

describe('write sets', () => {
  const body = `
  let todos = [{ id: 'a', done: false, text: '' }];
  let draft = '';
  let count = 0;
  const view = <button on:click={() => run()}>{todos.length}{draft}{count}</button>;
  `;

  function wrap(handlers: string): string {
    return `${HEAD}
    export default function App(): JSX.Element {
      ${body}
      ${handlers}
      return view;
    }`;
  }

  it('unions the writes of a handler with those of the handlers it calls', () => {
    const writes = getWrites(
      wrap(`
      function toggle(id: string) {
        todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      }
      function setDraft(text: string) {
        draft = text;
      }
      function run() {
        toggle('a');
        setDraft('');
      }`),
    );
    expect(writes.run).toEqual(['todos.*.done', 'draft']);
  });

  it('gives the whole field for a map that is not the pattern', () => {
    const writes = getWrites(
      wrap(`
      function a(id: string) {
        todos = todos.map((t) => ({ ...t, done: true }));
      }
      function b(id: string) {
        todos = todos.map((t) => (t.id === id ? { ...t } : t));
      }
      function c(id: string) {
        todos = todos.map((t) => (t.id === id ? { ...t, done: true } : { ...t }));
      }
      function d(id: string) {
        todos = todos.map((t) => (t.id === id ? { ...t, ['done']: true } : t));
      }
      function run() {
        a('a');
        b('a');
        c('a');
        d('a');
      }`),
    );
    expect(writes.a).toEqual(['todos']);
    expect(writes.b).toEqual(['todos']);
    expect(writes.c).toEqual(['todos']);
    expect(writes.d).toEqual(['todos']);
  });

  it('gives each field the pattern sets', () => {
    const writes = getWrites(
      wrap(`
      function edit(id: string, text: string) {
        todos = todos.map((t) => (t.id === id ? { ...t, text, done: false } : t));
      }
      function run() {
        edit('a', '');
      }`),
    );
    expect(writes.edit).toEqual(['todos.*.text', 'todos.*.done']);
  });

  it('gives the whole field for a write the pattern does not cover', () => {
    const writes = getWrites(
      wrap(`
      function bump() {
        count++;
      }
      function addTwo() {
        count += 2;
      }
      function noop() {}
      function run() {
        bump();
        addTwo();
        noop();
      }`),
    );
    expect(writes.bump).toEqual(['count']);
    expect(writes.addTwo).toEqual(['count']);
    expect(writes.noop).toEqual([]);
  });

  it('reads destructuring targets as writes of their fields', () => {
    const writes = getWrites(
      wrap(`
      function swap() {
        [draft, count] = [String(count), Number(draft)];
      }
      function pick(next: { draft: string }) {
        ({ draft } = next);
      }
      function run() {
        swap();
        pick({ draft: '' });
      }`),
    );
    expect(writes.swap).toEqual(['draft', 'count']);
    expect(writes.pick).toEqual(['draft']);
  });

  it('gives no write set for a write it cannot read', () => {
    const writes = getWrites(
      wrap(`
      function push() {
        todos.push({ id: 'b', done: false, text: '' });
      }
      function deep() {
        todos[0].done = true;
      }
      function member() {
        todos[0].text += 'x';
      }
      function update() {
        todos[0].count++;
      }
      function remove() {
        delete todos[0].text;
      }
      function sort() {
        todos.sort();
      }
      function viaCall() {
        push();
        draft = '';
      }
      function run() {
        push();
        deep();
        member();
        update();
        remove();
        sort();
        viaCall();
      }`),
    );
    for (const name of ['push', 'deep', 'member', 'update', 'remove', 'sort', 'viaCall', 'run']) {
      expect(writes[name], name).toBeUndefined();
    }
  });

  it('keeps a write set for reads and copies of state', () => {
    const writes = getWrites(
      wrap(`
      function copy() {
        todos = todos.slice().sort();
        draft = todos[0].text;
      }
      function run() {
        copy();
      }`),
    );
    expect(writes.copy).toEqual(['todos', 'draft']);
  });

  it('ignores a local that is named like a field', () => {
    const writes = getWrites(
      wrap(`
      function shadow() {
        let draft = '';
        draft = 'x';
        return draft;
      }
      function run() {
        shadow();
      }`),
    );
    expect(writes.shadow).toEqual([]);
  });
});

describe('meetsPath', () => {
  it('meets paths where one is a prefix of the other', () => {
    expect(meetsPath('todos', 'todos.*.done')).toBe(true);
    expect(meetsPath('todos.*.done', 'todos')).toBe(true);
    expect(meetsPath('todos.*.done', 'todos.*.done')).toBe(true);
  });

  it('does not meet different fields', () => {
    expect(meetsPath('todos.*.id', 'todos.*.done')).toBe(false);
    expect(meetsPath('draft', 'todos')).toBe(false);
    expect(meetsPath('save.state', 'save')).toBe(true);
  });

  it('matches * to any item and a keyed segment to *', () => {
    expect(meetsPath('todos.*.done', 'todos.a.done')).toBe(true);
    expect(meetsPath('todos[id=selected].done', 'todos.*.done')).toBe(true);
    expect(meetsPath('todos[id=selected].done', 'todos.*.text')).toBe(false);
  });
});
