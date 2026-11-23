/**
 * Generates model states from a model that the server rendered. Every state keeps the shape of
 * the original: a field keeps its type, and a keyed list keeps unique keys.
 */
import type { Model } from '../../src/core/format.ts';

/** A small seeded generator, so a failing pair reproduces from its seed. */
export interface Random {
  next: () => number;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0 || 1;
  return {
    next() {
      // xorshift32
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4_294_967_296;
    },
  };
}

const STRINGS = [
  '',
  'a',
  'show',
  'all',
  'open',
  'x & <y>',
  '"quoted" and \'single\'',
  '<i>one</i>',
  '<b>two</b> &amp; three',
  '  spaced  ',
  'line\nbreak',
  '0',
];

const NUMBERS = [0, 1, 2, 3, -1, 10, 41, 1.5];

function pick<T>(random: Random, list: readonly T[]): T {
  return list[Math.floor(random.next() * list.length)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Context {
  readonly random: Random;
  /** Key field by list path, with `*` for each list level. */
  readonly keys: ReadonlyMap<string, string | undefined>;
  fresh: number;
}

function mutateKey(context: Context, key: unknown): unknown {
  context.fresh++;
  return typeof key === 'number' ? 1000 + context.fresh : `k${context.fresh}`;
}

function mutateValue(context: Context, value: unknown, path: string): unknown {
  const { random } = context;
  if (typeof value === 'boolean') {
    return random.next() < 0.5 ? value : !value;
  }
  if (typeof value === 'number') {
    return random.next() < 0.4 ? value : pick(random, NUMBERS);
  }
  if (typeof value === 'string') {
    return random.next() < 0.4 ? value : pick(random, STRINGS);
  }
  if (Array.isArray(value)) {
    return mutateList(context, value, path);
  }
  if (isRecord(value)) {
    return mutateRecord(context, value, path);
  }
  return value;
}

function mutateRecord(
  context: Context,
  record: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(record)) {
    next[name] = mutateValue(context, value, path === '' ? name : `${path}.${name}`);
  }
  return next;
}

function shuffle<T>(random: Random, list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random.next() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function mutateList(context: Context, list: readonly unknown[], path: string): unknown[] {
  const { random } = context;
  const itemPath = `${path}.*`;
  const key = context.keys.get(path);
  const rows: unknown[] = [];
  // Keep some rows as they are, edit some, drop the rest.
  for (const item of list) {
    const roll = random.next();
    if (roll < 0.3) {
      rows.push(item);
    } else if (roll < 0.7) {
      rows.push(mutateValue(context, item, itemPath));
    }
  }
  // Append rows made from an existing row.
  const appends = list.length === 0 ? 0 : Math.floor(random.next() * 3);
  for (let count = 0; count < appends; count++) {
    const made = mutateValue(context, pick(random, list), itemPath);
    if (key !== undefined && isRecord(made)) {
      made[key] = mutateKey(context, made[key]);
    }
    rows.push(made);
  }
  const ordered = random.next() < 0.4 ? shuffle(random, rows) : rows;
  if (key === undefined) {
    return ordered;
  }
  // A keyed list needs unique keys.
  const seen = new Set<unknown>();
  const unique: unknown[] = [];
  for (const row of ordered) {
    const id = isRecord(row) ? row[key] : row;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(row);
    }
  }
  return unique;
}

/** Returns a model that differs from `model` in a random way. */
export function mutateModel(
  random: Random,
  keys: ReadonlyMap<string, string | undefined>,
  model: Model,
): Model {
  const context: Context = { random, keys, fresh: 0 };
  return mutateRecord(context, model, '');
}
