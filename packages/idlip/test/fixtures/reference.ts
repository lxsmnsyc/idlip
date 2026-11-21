import { serialize } from 'seroval';
import type {
  DomMessage,
  Manifest,
  Model,
  PageState,
  RenderContext,
} from '../../src/core/format.ts';

// Reference versions of the render helpers in contracts/compiled-format.md, Render helpers.
// The fixture test renders the expected server module with them and compares the page.
// `ssr-render` and the client runtime ship the real ones.

function toText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  // The contract renders other values with `String`. The fixtures never do.
  throw new TypeError('The reference helpers render only primitives');
}

/**
 * Returns a hole's value as escaped text.
 */
export function text(value: unknown): string {
  return toText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function joinClass(value: object): string {
  const names: string[] = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

/**
 * Returns an attribute with a leading space, or an empty string when it is absent.
 */
export function attr(name: string, value: unknown): string {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (value === true) {
    return ` ${name}`;
  }
  if (typeof value === 'object') {
    // Only `class` takes an object: the names whose values are truthy.
    const names = joinClass(value);
    return names === '' ? '' : ` ${name}="${escapeAttr(names)}"`;
  }
  return ` ${name}="${escapeAttr(toText(value))}"`;
}

/**
 * Returns an `on:<event>` attribute with a leading space.
 */
export function on(event: string, message: DomMessage): string {
  const json = JSON.stringify(message).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
  return ` on:${event}='${json}'`;
}

/**
 * Returns a render context and a function that writes its state script.
 */
export function createContext(): { context: RenderContext; writeState: () => string } {
  let recorded: PageState | undefined;
  const context: RenderContext = {
    state(state) {
      recorded = state;
    },
  };
  function writeState(): string {
    if (recorded === undefined) {
      throw new Error('The module recorded no state');
    }
    const events = recorded.manifest.events.join(' ');
    // seroval's output is a parenthesized expression, so it serves as the arrow body as it is.
    const state = serialize(recorded);
    return `<script i-state>(self.$idlip||=[]).push([${JSON.stringify(events)},()=>${state}])</script>`;
  }
  return { context, writeState };
}

function readField(value: unknown, field: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
}

function listItems(value: unknown): Map<string, unknown> {
  const items = new Map<string, unknown>();
  if (typeof value === 'object' && value !== null) {
    for (const [field, item] of Object.entries(value)) {
      items.set(field, item);
    }
  }
  return items;
}

function listKeyed(value: unknown, key: string): Map<unknown, unknown> {
  const items = new Map<unknown, unknown>();
  if (Array.isArray(value)) {
    const values: unknown[] = value;
    for (const item of values) {
      items.set(readField(item, key), item);
    }
  }
  return items;
}

function joinPath(prefix: string, segment: string): string {
  return prefix === '' ? segment : `${prefix}.${segment}`;
}

function checkChanged(
  prev: unknown,
  next: unknown,
  segments: readonly string[],
  prefix: string,
  keys: Readonly<Record<string, string>>,
): boolean {
  if (prev === next) {
    return false;
  }
  if (segments.length === 0) {
    return true;
  }
  const [segment = '', ...rest] = segments;
  if (segment !== '*') {
    const path = joinPath(prefix, segment);
    return checkChanged(readField(prev, segment), readField(next, segment), rest, path, keys);
  }
  const itemPath = joinPath(prefix, '*');
  // Under a keyed list the path changes when it differs by key or by index. By key covers row
  // bindings after a reorder. By index covers holes outside rows, such as `todos[selected].done`.
  if (Object.hasOwn(keys, prefix)) {
    const key = keys[prefix];
    const before = listKeyed(prev, key);
    for (const [id, item] of listKeyed(next, key)) {
      if (before.has(id) && checkChanged(before.get(id), item, rest, itemPath, keys)) {
        return true;
      }
    }
  }
  // By index or field, where an item on one side only is a change.
  const before = listItems(prev);
  const after = listItems(next);
  for (const field of new Set([...before.keys(), ...after.keys()])) {
    if (!before.has(field) || !after.has(field)) {
      return true;
    }
    if (checkChanged(before.get(field), after.get(field), rest, itemPath, keys)) {
      return true;
    }
  }
  return false;
}

/**
 * A reference `diffPaths`: the paths whose values differ by reference.
 */
export function diffPaths(
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Readonly<Record<string, string>>,
): Set<string> {
  const changed = new Set<string>();
  for (const path of paths) {
    if (checkChanged(prev, next, path.split('.'), '', keys)) {
      changed.add(path);
    }
  }
  return changed;
}

function hasChanged(paths: readonly string[], changed: ReadonlySet<string>): boolean {
  for (const path of paths) {
    if (changed.has(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the binding chunks a patch loads: changed groups in manifest order, minus covered ones.
 */
export function selectChunks(manifest: Manifest, prev: Model, next: Model): string[] {
  const keys: Record<string, string> = {};
  for (const list of Object.values(manifest.lists)) {
    if (list.path !== undefined) {
      keys[list.path] = list.key;
    }
  }
  const paths: string[] = [];
  for (const group of Object.values(manifest.groups)) {
    paths.push(...group.paths);
  }
  const changed = diffPaths(prev, next, paths, keys);
  const handled = new Set<string>();
  const chunks: string[] = [];
  for (const [key, group] of Object.entries(manifest.groups)) {
    if (handled.has(key) || !hasChanged(group.paths, changed)) {
      continue;
    }
    chunks.push(group.chunk);
    handled.add(key);
    for (const covered of group.covers) {
      handled.add(covered);
    }
  }
  return chunks;
}
