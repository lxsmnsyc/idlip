import { serialize } from 'seroval';
import { getChunkId } from '../../src/core/format.ts';
import type {
  ChildManifest,
  ChunkUrls,
  DomMessage,
  HandlerEntry,
  Manifest,
  Model,
  PageState,
  Props,
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

/** A child's state in the state script (`nesting-format`): the module, the model and the props. */
export interface Slot {
  readonly module: string;
  readonly model: Model;
  readonly props: Props;
}

/** A compiled server module as the render context sees it: its manifest, chunks and children. */
export interface ModuleInfo {
  readonly manifest: Manifest;
  readonly chunks: ChunkUrls;
  readonly uses?: readonly ModuleInfo[];
}

/** What a component passes to `context.state`. `uses` is the server modules of its children. */
export interface ComponentState extends PageState {
  readonly uses?: readonly ModuleInfo[];
}

/** `RenderContext` with the nesting additions of `nesting-format`. */
export interface NestedContext {
  state(state: ComponentState, path?: string): void;
  /** The slots to render from, set when a test re-renders from a model. */
  readonly slots?: Readonly<Record<string, Slot>>;
}

function escapePart(part: string): string {
  return encodeURIComponent(part).replaceAll('-', '%2D');
}

/**
 * Returns the model path of a child: the parent's path, then `<site>` and one escaped key per
 * enclosing loop (outermost first), or the explicit `key` when the child has one.
 */
export function slot(path: string, site: number, ...keys: unknown[]): string {
  let id = String(site);
  for (const key of keys) {
    id += `:${escapePart(String(key))}`;
  }
  return path === '' ? id : `${path}/${id}`;
}

/** A client view chunk, as the item template chunk of a parent imports it. */
export interface ViewChunk {
  init: (props: Props) => Model;
  render: (scope: { model: Model; props: Props; rows: []; path: string }) => string;
}

/** The slots `addChild` recorded in the reference client. */
export const slots: Map<string, Slot> = new Map<string, Slot>();

/**
 * A reference `addChild` of `idlip/client`: makes the child's model, records the slot and returns
 * the child's markup between its boundary comments.
 */
export function addChild(path: string, module: string, view: ViewChunk, props: Props): string {
  const model = view.init(props);
  slots.set(path, { module, model, props });
  return `<!--n:${path}-->${view.render({ model, props, rows: [], path })}<!--/n-->`;
}

function collectModules(
  uses: readonly ModuleInfo[],
  modules: Map<string, Manifest>,
  chunks: Record<string, string>,
): void {
  for (const info of uses) {
    if (!modules.has(info.manifest.module)) {
      modules.set(info.manifest.module, info.manifest);
      const { module, view } = info.manifest;
      const viewId = view === undefined ? undefined : getChunkId(module, view.chunk);
      for (const [id, url] of Object.entries(info.chunks)) {
        if (id !== viewId) {
          chunks[id] = url;
        }
      }
      collectModules(info.uses ?? [], modules, chunks);
    }
  }
}

/**
 * A child manifest as the state script holds it: without `events`, `listens`, `view` and the
 * `writes` of each handler, which the loader never reads.
 */
export function toClientManifest(manifest: Manifest): ChildManifest {
  const { events: _events, listens: _listens, view: _view, handlers, ...rest } = manifest;
  const slim: Record<string, HandlerEntry> = {};
  for (const [tag, entry] of Object.entries(handlers)) {
    const { writes: _writes, ...kept } = entry;
    slim[tag] = kept;
  }
  return { ...rest, handlers: slim };
}

/**
 * Returns a render context and a function that writes its state script. The root state comes
 * from the call without a path, children from the calls with one. The chunk URLs, the manifests
 * and the event types of the children are merged into the root's, as `ssr-render` does.
 */
export function createContext(): { context: NestedContext; writeState: () => string } {
  let root: ComponentState | undefined;
  const children = new Map<string, Slot>();
  const modules = new Map<string, Manifest>();
  const chunks: Record<string, string> = {};
  const context: NestedContext = {
    state(state, path) {
      // The root has no path, or the empty one.
      if (path === undefined || path === '') {
        root = state;
      } else {
        children.set(path, {
          module: state.manifest.module,
          model: state.model,
          props: state.props,
        });
        collectModules([state], modules, chunks);
      }
      collectModules(state.uses ?? [], modules, chunks);
    },
  };
  function writeState(): string {
    if (root === undefined) {
      throw new Error('The module recorded no state');
    }
    modules.delete(root.manifest.module);
    const events = new Set(root.manifest.events);
    for (const manifest of modules.values()) {
      for (const event of manifest.events) {
        events.add(event);
      }
    }
    const state: Record<string, unknown> = {
      manifest: root.manifest,
      chunks: { ...root.chunks, ...chunks },
      model: root.model,
      props: root.props,
    };
    if (children.size > 0) {
      state.slots = Object.fromEntries(children);
    }
    if (modules.size > 0) {
      state.modules = Object.fromEntries(
        [...modules].map(([module, manifest]) => [module, toClientManifest(manifest)]),
      );
    }
    const names = [...events].toSorted().join(' ');
    // seroval's output is a parenthesized expression, so it serves as the arrow body as it is.
    return `<script i-state>(self.$idlip||=[]).push([${JSON.stringify(names)},()=>${serialize(state)}])</script>`;
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
