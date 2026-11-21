import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { diffPaths } from '../../../src/client/patch/diff.ts';

type Card = { id: string; title: string };
type Column = { id: string; name: string; cards: Card[] };
type Todo = { id: string; text: string; done: boolean };
type Loose = { done: boolean };
type State = {
  draft: string;
  selected: number;
  todos: Todo[];
  columns: Column[];
  tags: string[];
  labels: Record<string, { text: string }>;
  maybe: Loose[] | string | undefined;
};

const KEYS = { todos: 'id', columns: 'id', 'columns.*.cards': 'id' };
const PATHS = [
  'draft',
  'selected',
  'todos',
  'todos.*.id',
  'todos.*.text',
  'todos.*.done',
  'columns',
  'columns.*.name',
  'columns.*.cards',
  'columns.*.cards.*.title',
  // An unkeyed list, a `*` over a record, and a list that stops being one.
  'tags',
  'tags.*',
  'labels.*.text',
  'maybe.*.done',
];

const arbTodo = fc.record({ text: fc.string({ maxLength: 3 }), done: fc.boolean() });
const arbCard = fc.record({ title: fc.string({ maxLength: 3 }) });
const arbColumn = fc.record({
  name: fc.string({ maxLength: 3 }),
  cards: fc.array(arbCard, { maxLength: 4 }),
});
const arbState = fc.record({
  draft: fc.string({ maxLength: 3 }),
  selected: fc.nat(3),
  todos: fc.array(arbTodo, { maxLength: 5 }),
  columns: fc.array(arbColumn, { maxLength: 3 }),
  tags: fc.array(fc.constantFrom('a', 'b', 'c'), { maxLength: 4 }),
  labels: fc.dictionary(
    fc.constantFrom('p', 'q', 'r'),
    fc.record({ text: fc.constantFrom('x', 'y') }),
  ),
  maybe: fc.oneof(
    fc.constant(undefined),
    fc.constant('text'),
    fc.array(fc.record({ done: fc.boolean() }), { maxLength: 3 }),
  ),
});

type RawState = typeof arbState extends fc.Arbitrary<infer T> ? T : never;

function withIds<T extends object>(items: T[], prefix: string): (T & { id: string })[] {
  return items.map((item, index) => ({ ...item, id: `${prefix}${index}` }));
}

function buildState(raw: RawState): State {
  return {
    ...raw,
    todos: withIds(raw.todos, 't'),
    columns: withIds(
      raw.columns.map((column) => ({ ...column, cards: withIds(column.cards, 'k') })),
      'c',
    ),
  };
}

/** A source of random choices for building the next model from the previous one. */
function createPicker(numbers: number[]): (count: number) => number {
  let at = 0;
  return (count) => {
    const value = numbers[at % numbers.length] ?? 0;
    at++;
    return value % count;
  };
}

/** Keeps, copies (same values, new reference), edits, drops or reorders items. */
function evolveList<T extends { id: string }>(
  items: readonly T[],
  pick: (count: number) => number,
  edit: (item: T) => T,
): T[] {
  const result: T[] = [];
  for (const item of items) {
    const choice = pick(5);
    if (choice === 0) {
      continue;
    }
    if (choice === 1) {
      result.push({ ...item });
    } else if (choice === 2) {
      result.push(edit(item));
    } else {
      result.push(item);
    }
  }
  if (pick(3) === 0) {
    result.reverse();
  }
  if (pick(3) === 0 && result.length > 1) {
    result.push(result.shift()!);
  }
  return result;
}

function evolveMaybe(prev: State['maybe'], pick: (count: number) => number): State['maybe'] {
  const choice = pick(6);
  if (choice < 2) {
    return prev;
  }
  if (choice === 2) {
    return undefined;
  }
  if (choice === 3) {
    return 'text';
  }
  const list = Array.isArray(prev) ? prev : [];
  if (choice === 4) {
    return [...list, { done: true }];
  }
  return list.map((item) => ({ ...item }));
}

function evolveLabels(prev: State['labels'], pick: (count: number) => number): State['labels'] {
  const labels: State['labels'] = {};
  for (const [name, label] of Object.entries(prev)) {
    const choice = pick(4);
    if (choice === 1) {
      labels[name] = { ...label };
    } else if (choice === 2) {
      labels[name] = { text: `${label.text}x` };
    } else if (choice === 3) {
      labels[name] = label;
    }
  }
  if (pick(3) === 0) {
    labels.s = { text: 'new' };
  }
  return labels;
}

function evolve(prev: State, numbers: number[]): State {
  const pick = createPicker(numbers);
  const edited = pick(2) === 0 ? prev.tags : [...prev.tags, 'd'];
  return {
    draft: pick(2) === 0 ? prev.draft : `${prev.draft}x`,
    selected: pick(2) === 0 ? prev.selected : prev.selected + 1,
    todos:
      pick(4) === 0 ? prev.todos : evolveList(prev.todos, pick, (t) => ({ ...t, done: !t.done })),
    columns:
      pick(4) === 0
        ? prev.columns
        : evolveList(prev.columns, pick, (column) => ({
            ...column,
            name: `${column.name}x`,
            cards: evolveList(column.cards, pick, (card) => ({ ...card, title: `${card.title}x` })),
          })),
    tags: pick(3) === 0 ? prev.tags.toReversed() : edited,
    labels: pick(3) === 0 ? prev.labels : evolveLabels(prev.labels, pick),
    maybe: evolveMaybe(prev.maybe, pick),
  };
}

// The oracle lists the value pairs a path compares, then checks them with `!==`. It is a
// different shape from `diffPaths`, which walks and stops at the first change.
type Pair = readonly [unknown, unknown];

function asObject(value: unknown): object {
  return typeof value === 'object' && value !== null ? value : {};
}

function readField(value: unknown, field: string): unknown {
  const found: unknown = Reflect.get(asObject(value), field);
  return found;
}

function getFields(value: unknown): string[] {
  return Object.keys(asObject(value));
}

function listPairs(
  prev: unknown,
  next: unknown,
  segments: string[],
  prefix: string,
  keys: Record<string, string>,
): Pair[] | 'missing' {
  const [head, ...rest] = segments;
  if (segments.length === 0) {
    return [[prev, next]];
  }
  if (head !== '*') {
    return listPairs(readField(prev, head), readField(next, head), rest, `${prefix}${head}.`, keys);
  }
  const key = prefix.slice(0, -1);
  const itemPrefix = `${prefix}*.`;
  const pairs: Pair[] = [];
  // Items pair by field, which is the index in a list. One present on one side only is a change.
  for (const field of new Set([...getFields(prev), ...getFields(next)])) {
    if (!(field in asObject(prev)) || !(field in asObject(next))) {
      return 'missing';
    }
    const inner = listPairs(readField(prev, field), readField(next, field), rest, itemPrefix, keys);
    if (inner === 'missing') {
      return 'missing';
    }
    pairs.push(...inner);
  }
  if (key in keys && Array.isArray(prev) && Array.isArray(next)) {
    const before: unknown[] = prev;
    const after: unknown[] = next;
    for (const item of after) {
      const match = before.find(
        (other) => readField(other, keys[key]) === readField(item, keys[key]),
      );
      if (match !== undefined) {
        const inner = listPairs(match, item, rest, itemPrefix, keys);
        if (inner === 'missing') {
          return 'missing';
        }
        pairs.push(...inner);
      }
    }
  }
  return pairs;
}

function expectChanged(prev: State, next: State, path: string): boolean {
  const pairs = listPairs(prev, next, path.split('.'), '', KEYS);
  if (pairs === 'missing') {
    return true;
  }
  return pairs.some(([a, b]) => a !== b);
}

describe('diffPaths', () => {
  it('returns exactly the paths whose values differ', () => {
    fc.assert(
      fc.property(arbState, fc.array(fc.nat(), { minLength: 1, maxLength: 60 }), (raw, numbers) => {
        const prev = buildState(raw);
        const next = evolve(prev, numbers);
        const expected = new Set<string>();
        for (const path of PATHS) {
          if (expectChanged(prev, next, path)) {
            expected.add(path);
          }
        }
        expect(diffPaths({ ...prev }, { ...next }, PATHS, KEYS)).toEqual(expected);
      }),
      { numRuns: 1000 },
    );
  });

  it('returns nothing for the same model', () => {
    fc.assert(
      fc.property(arbState, (raw) => {
        const state = buildState(raw);
        expect(diffPaths(state, state, PATHS, KEYS).size).toBe(0);
      }),
    );
  });

  it('pairs by index when the list has no key', () => {
    const a = { id: 'a', done: false };
    const b = { id: 'b', done: true };
    const swapped = diffPaths({ todos: [a, b] }, { todos: [b, a] }, ['todos.*.done'], {});
    expect([...swapped]).toEqual(['todos.*.done']);
    const same = diffPaths({ todos: [a, b] }, { todos: [a, b] }, ['todos.*.done'], {});
    expect(same.size).toBe(0);
  });

  it('sees a moved item under a keyed list, and a hole outside rows', () => {
    const before = [
      { id: 'a1', done: false },
      { id: 'a2', done: true },
    ];
    const after = [
      { id: 'a2', done: false },
      { id: 'a1', done: true },
    ];
    // By index the values read [false, true] on both sides. By key a1 and a2 both changed.
    const model = { selected: 0, todos: before };
    const moved = diffPaths(model, { selected: 0, todos: after }, ['todos.*.done', 'selected'], {
      todos: 'id',
    });
    expect([...moved]).toEqual(['todos.*.done']);
  });

  it('counts an item on one side only as a change', () => {
    const todo = { id: 'a', done: false };
    expect(diffPaths({ todos: [todo] }, { todos: [todo, todo] }, ['todos.*.done'], {}).size).toBe(
      1,
    );
    expect(diffPaths({ todos: [todo, todo] }, { todos: [todo] }, ['todos.*.done'], {}).size).toBe(
      1,
    );
  });
});
