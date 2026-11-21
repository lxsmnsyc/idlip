import type { Manifest, Model } from '../../core/format.ts';
import { isRecord } from './guards.ts';

type Keys = Readonly<Record<string, string>>;

function readField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

function checkKeyed(
  prev: unknown,
  next: unknown,
  key: string,
  segments: readonly string[],
  at: number,
  itemPath: string,
  keys: Keys,
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
    if (before.has(id) && checkChanged(before.get(id), item, segments, at, itemPath, keys)) {
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
): boolean {
  // Updates are immutable, so the same reference means nothing below it changed.
  if (prev === next) {
    return false;
  }
  if (at === segments.length) {
    return true;
  }
  const segment = segments[at];
  if (segment !== '*') {
    const path = prefix === '' ? segment : `${prefix}.${segment}`;
    return checkChanged(
      readField(prev, segment),
      readField(next, segment),
      segments,
      at + 1,
      path,
      keys,
    );
  }
  const itemPath = prefix === '' ? '*' : `${prefix}.*`;
  // Under a keyed list the path changes when it differs by key or by index. By key covers
  // row bindings after a reorder. By index covers holes such as `todos[selected].done`.
  if (
    Object.hasOwn(keys, prefix) &&
    checkKeyed(prev, next, keys[prefix], segments, at + 1, itemPath, keys)
  ) {
    return true;
  }
  const before = isRecord(prev) ? prev : {};
  const after = isRecord(next) ? next : {};
  // An item on one side only is a change.
  for (const field of Object.keys(before)) {
    if (
      !Object.hasOwn(after, field) ||
      checkChanged(before[field], after[field], segments, at + 1, itemPath, keys)
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
 * a keyed list also by key.
 */
export function diffPaths(
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Keys,
): Set<string> {
  const changed = new Set<string>();
  for (const path of paths) {
    if (checkChanged(prev, next, path.split('.'), 0, '', keys)) {
      changed.add(path);
    }
  }
  return changed;
}
