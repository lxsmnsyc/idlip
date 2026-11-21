import type { Manifest, Model } from '../../core/format.ts';
import { HAS_KEYED } from '../features.ts';
import { isRecord } from './guards.ts';

/** Splits at the dots outside brackets, and reads `todos[id=selected]`. */
const SPLIT = /\.(?![^[]*\])/;
const KEYED = /^(\w+)\[(\w+)=([^\]]*)\]$/;

type Keys = Readonly<Record<string, string>>;

/** The models being compared, for the sources of keyed segments. */
interface Roots {
  readonly prev: unknown;
  readonly next: unknown;
}

function readField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

/** Finds the item of `name[field=source]` in a model, or undefined without a key value. */
function findItem(model: unknown, root: unknown, [, name, field, source]: string[]): unknown {
  let id = root;
  for (const part of source.split('.')) {
    id = readField(id, part);
  }
  const list = readField(model, name);
  return id === undefined || !Array.isArray(list)
    ? undefined
    : list.find((item) => readField(item, field) === id);
}

function checkKeyed(
  prev: unknown,
  next: unknown,
  key: string,
  segments: readonly string[],
  at: number,
  itemPath: string,
  keys: Keys,
  roots: Roots,
): boolean {
  if (!Array.isArray(prev) || !Array.isArray(next)) {
    return false;
  }
  const before = new Map<unknown, unknown>();
  for (const item of prev) {
    before.set(readField(item, key), item);
  }
  for (const item of next) {
    const id = readField(item, key);
    if (before.has(id) && checkChanged(before.get(id), item, segments, at, itemPath, keys, roots)) {
      return true;
    }
  }
  return false;
}

function checkChanged(
  prev: unknown,
  next: unknown,
  segments: readonly string[],
  at: number,
  prefix: string,
  keys: Keys,
  roots: Roots,
): boolean {
  // Updates are immutable, so the same reference means nothing below it changed.
  if (prev === next) {
    return false;
  }
  if (at === segments.length) {
    return true;
  }
  const segment = segments[at];
  const keyed = HAS_KEYED ? KEYED.exec(segment) : null;
  if (keyed !== null) {
    // An item found on one side only is a change.
    const before = findItem(prev, roots.prev, keyed);
    const after = findItem(next, roots.next, keyed);
    return before === undefined || after === undefined
      ? before !== after
      : checkChanged(before, after, segments, at + 1, `${prefix}.${segment}`, keys, roots);
  }
  if (segment !== '*') {
    const path = prefix === '' ? segment : `${prefix}.${segment}`;
    return checkChanged(
      readField(prev, segment),
      readField(next, segment),
      segments,
      at + 1,
      path,
      keys,
      roots,
    );
  }
  const itemPath = prefix === '' ? '*' : `${prefix}.*`;
  // Under a keyed list the path changes when it differs by key or by index. By key covers
  // row bindings after a reorder. By index covers holes such as `todos[selected].done`.
  if (
    Object.hasOwn(keys, prefix) &&
    checkKeyed(prev, next, keys[prefix], segments, at + 1, itemPath, keys, roots)
  ) {
    return true;
  }
  const before = isRecord(prev) ? prev : {};
  const after = isRecord(next) ? next : {};
  // An item on one side only is a change.
  for (const field of Object.keys(before)) {
    if (
      !Object.hasOwn(after, field) ||
      checkChanged(before[field], after[field], segments, at + 1, itemPath, keys, roots)
    ) {
      return true;
    }
  }
  for (const field of Object.keys(after)) {
    if (!Object.hasOwn(before, field)) {
      return true;
    }
  }
  return false;
}

/** Returns the key field of each keyed `<For>`, by its list path. */
export function getListKeys(manifest: Manifest): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const list of Object.values(manifest.lists)) {
    if (list.path !== undefined) {
      keys[list.path] = list.key;
    }
  }
  return keys;
}

/**
 * Returns the paths whose values differ by reference. A `*` pairs items by index, and under
 * a keyed list also by key. A keyed segment such as `todos[id=selected]` compares the item
 * found by key on each side.
 */
export function diffPaths(
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Keys,
): Set<string> {
  const changed = new Set<string>();
  for (const path of paths) {
    if (checkChanged(prev, next, path.split(SPLIT), 0, '', keys, { prev, next })) {
      changed.add(path);
    }
  }
  return changed;
}
