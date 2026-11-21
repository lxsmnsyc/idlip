import { DEV } from '../core/dev.ts';
import type { Model, Patch, Props, QueuedEvent, ViewChunk } from '../core/format.ts';
import type { Child, Nesting, Root, Unit } from './loader/resume.ts';
import { isComment } from './patch/guards.ts';
import { onBlock } from './patch/index.ts';

/** A path that left the page keeps its generation, so the next `addChild` counts on. */
type Entry = Child | { readonly kind: 'removed'; readonly gen: number };

/** The slot table of each root, made from the state script on first use. */
const tables = new WeakMap<Root, Map<string, Entry>>();
/** The children whose props changed in the patch that runs. */
const dirty = new Set<Child>();
/** The root that the running patch belongs to, for `addChild` and `setProp`. */
let active: Root | undefined;

function createChild(
  top: Root,
  path: string,
  gen: number,
  module: string,
  model: Model,
  props: Props,
): Child {
  const manifest = top.state.modules![module];
  return {
    kind: 'live',
    path,
    gen,
    top,
    script: top.script,
    state: { manifest, chunks: top.state.chunks, model, props },
    model,
    rendered: model,
    shown: props,
    page: { root: top.page.root, manifest, props, load: top.page.load, path },
  };
}

function getTable(top: Root): Map<string, Entry> {
  let table = tables.get(top);
  if (table === undefined) {
    table = new Map();
    for (const [path, slot] of Object.entries(top.state.slots ?? {})) {
      table.set(path, createChild(top, path, 0, slot.module, slot.model, slot.props));
    }
    tables.set(top, table);
  }
  return table;
}

/** The live children of a root, with the ones that patches added. */
export function getChildren(top: Root): Child[] {
  const children: Child[] = [];
  for (const entry of getTable(top).values()) {
    if (entry.kind === 'live') {
      children.push(entry);
    }
  }
  return children;
}

function getLive(top: Root, path: string): Child | undefined {
  const entry = getTable(top).get(path);
  return entry?.kind === 'live' ? entry : undefined;
}

/** Finds the start comment of the boundary around a node: the first unmatched one. */
function findBoundary(node: Node): Comment | undefined {
  for (let up: Node | null = node; up !== null; up = up.parentNode) {
    let depth = 0;
    for (let item = up.previousSibling; item !== null; item = item.previousSibling) {
      if (isComment(item)) {
        if (item.data === '/n') {
          depth++;
        } else if (item.data.startsWith('n:') && depth-- === 0) {
          return item;
        }
      }
    }
  }
  return undefined;
}

/** Records the start comment of every boundary in the page, for children found by path. */
function findBoundaries(top: Root): void {
  const walker = top.page.root.ownerDocument!.createTreeWalker(top.page.root, 128);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const data = isComment(node) ? node.data : '';
    const child = data.startsWith('n:') ? getLive(top, data.slice(2)) : undefined;
    if (isComment(node) && child !== undefined && child.page.start === undefined) {
      child.page = { ...child.page, start: node };
    }
  }
}

/** Makes a child, records its slot as live and returns its markup between the boundary comments. */
export function addChild(path: string, module: string, view: ViewChunk, props: Props): string {
  const top = active!;
  const table = getTable(top);
  const model = view.init(props);
  table.set(path, createChild(top, path, (table.get(path)?.gen ?? -1) + 1, module, model, props));
  return `<!--n:${path}-->${view.render({ model, props, rows: [], path })}<!--/n-->`;
}

/** Sets a prop of a live slot when its value differs, and marks the slot to patch. */
export function setProp(path: string, name: string, value: unknown): void {
  const child = getLive(active!, path);
  if (child === undefined) {
    return;
  }
  const { props } = child.page;
  // A message prop is a new array on every run, so the compare is by value.
  if (props[name] !== value && JSON.stringify(props[name]) !== JSON.stringify(value)) {
    child.page = { ...child.page, props: { ...props, [name]: value } };
    dirty.add(child);
  }
}

function getDepth({ path }: Child): number {
  return path.split('/').length;
}

/**
 * Hooks the loader to nesting: events find their component by owner or boundary, a removed
 * block drops its slot, and a patch ends by patching the children whose props changed.
 */
export function installNesting(patch: Patch): Nesting {
  async function patchUnit(unit: Unit): Promise<void> {
    const { model, rendered, page } = unit;
    if (unit.kind === 'root') {
      if (model !== rendered) {
        await patch(page, rendered, model);
        unit.rendered = model;
      }
      return;
    }
    if (model === rendered && page.props === unit.shown) {
      return;
    }
    if (page.start === undefined) {
      findBoundaries(unit.top);
    }
    if (unit.page.start === undefined) {
      // Without its boundary the lookups would reach the nodes of the root.
      if (DEV) {
        // oxlint-disable-next-line no-console
        console.warn(
          `idlip: the boundary of ${unit.path} is not in the page, so it is not patched`,
        );
      }
      return;
    }
    // The props join the models, so the diff reads `props.x` paths.
    await patch(unit.page, { ...rendered, props: unit.shown }, { ...model, props: page.props });
    unit.rendered = model;
    unit.shown = page.props;
  }

  function live(unit: Unit): boolean {
    if (unit.kind === 'root') {
      return true;
    }
    const entry = getTable(unit.top).get(unit.path);
    return entry?.kind === 'live' && entry.gen === unit.gen;
  }

  function target(root: Root, event: QueuedEvent): Unit | undefined {
    let path = event.owner;
    if (path === undefined) {
      const start = findBoundary(event.target);
      path = start?.data.slice(2) ?? '';
      const child = getLive(root, path);
      if (start !== undefined && child !== undefined && child.page.start === undefined) {
        child.page = { ...child.page, start };
      }
    }
    return path === '' ? root : getLive(root, path);
  }

  async function patchAll(unit: Unit): Promise<void> {
    active = unit.kind === 'root' ? unit : unit.top;
    await patchUnit(unit);
    // Parents go before their children, and a child's patch can change its own children.
    while (dirty.size > 0) {
      const batch = [...dirty].toSorted((a, b) => getDepth(a) - getDepth(b));
      dirty.clear();
      for (const child of batch) {
        if (live(child)) {
          await patchUnit(child);
        }
      }
    }
  }

  onBlock(
    (start) => {
      const child = start.data.startsWith('n:') ? getLive(active!, start.data.slice(2)) : undefined;
      if (child !== undefined) {
        child.page = { ...child.page, start };
      }
    },
    (start) => {
      const path = start.data.slice(2);
      const table = getTable(active!);
      if (start.data.startsWith('n:') && table.has(path)) {
        table.set(path, { kind: 'removed', gen: table.get(path)!.gen });
      }
    },
  );
  return { target, live, patch: patchAll };
}
