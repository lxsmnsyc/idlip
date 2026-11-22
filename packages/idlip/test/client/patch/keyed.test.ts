import { describe, expect, it } from 'vitest';
import { diffPaths } from '../../../src/client/patch/diff.ts';
import { getChunkFile, getChunkId } from '../../../src/core/format.ts';

type Todo = {
  id: string;
  text: string;
};
type State = {
  selected: string;
  todos: Todo[];
};

const KEYS = { todos: 'id' };
const PATH = 'todos[id=selected].text';

const a: Todo = { id: 'a', text: 'one' };
const b: Todo = { id: 'b', text: 'two' };
const prev: State = { selected: 'a', todos: [a, b] };

function diff(next: State): boolean {
  return diffPaths(prev, next, [PATH], KEYS).has(PATH);
}

describe('keyed segments in diffPaths', () => {
  it('ignores a model whose items are the same', () => {
    expect(diff({ selected: 'a', todos: [a, b] })).toBe(false);
  });

  it('counts a change to the selected item', () => {
    expect(diff({ selected: 'a', todos: [{ ...a, text: 'uno' }, b] })).toBe(true);
  });

  it('counts a change of the key source', () => {
    expect(diff({ selected: 'b', todos: [a, b] })).toBe(true);
  });

  it('ignores a change to another item', () => {
    expect(diff({ selected: 'a', todos: [a, { ...b, text: 'dos' }] })).toBe(false);
  });

  it('ignores a reorder', () => {
    expect(diff({ selected: 'a', todos: [b, a] })).toBe(false);
  });

  it('counts a key missing on one side', () => {
    expect(diff({ selected: 'a', todos: [b] })).toBe(true);
    const missing: State = { selected: 'c', todos: [a, b] };
    const added: State = { selected: 'c', todos: [a, b, { id: 'c', text: 'x' }] };
    expect(diffPaths(missing, added, [PATH], KEYS)).toEqual(new Set([PATH]));
  });

  it('ignores a key missing on both sides', () => {
    const missing: State = { selected: 'c', todos: [a, b] };
    expect(diffPaths(missing, { ...missing, todos: [b, a] }, [PATH], KEYS).size).toBe(0);
  });

  it('finds no item when the key value is undefined', () => {
    const loose = [{ text: 'no id' }, a];
    const before = { selected: undefined, todos: loose };
    const after = { selected: undefined, todos: [{ text: 'changed' }, a] };
    expect(diffPaths(before, after, [PATH], KEYS).size).toBe(0);
  });

  it('reads a key source with dots', () => {
    const path = 'todos[id=view.selected].text';
    const before = { view: { selected: 'a' }, todos: [a, b] };
    const after = { view: { selected: 'b' }, todos: [a, b] };
    expect(diffPaths(before, after, [path], KEYS).has(path)).toBe(true);
    expect(diffPaths(before, { ...before }, [path], KEYS).has(path)).toBe(false);
  });
});

describe('getChunkFile with keyed segments', () => {
  it('maps brackets and the equals sign inside them', () => {
    expect(getChunkFile('binding=todos[id=selected].text')).toBe(
      'binding.todos(id~selected).text.js',
    );
  });

  it('keeps the existing mapping', () => {
    expect(getChunkFile('binding=todos.*.done')).toBe('binding.todos._.done.js');
    expect(getChunkFile('binding=a,b')).toBe('binding.a+b.js');
    expect(getChunkFile('handler=toggle')).toBe('handler.toggle.js');
  });

  it('gives a file name and a module id without reserved characters', () => {
    const chunk = 'binding=selected,todos[id=selected].text';
    expect(getChunkFile(chunk)).toMatch(/^[\w.()~+-]+$/);
    expect(getChunkId('/src/todo.tsx', chunk)).not.toMatch(/\s|#/);
  });
});
