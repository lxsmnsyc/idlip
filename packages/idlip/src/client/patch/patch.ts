import type {
  Binding,
  ListBinding,
  ListContext,
  Manifest,
  Model,
  NodeBinding,
  Page,
  Patch,
  PropBinding,
  Scope,
} from '../../core/format.ts';
import { failRegion } from '../errors.ts';
import { DYNAMIC_GROUP, getDynamic, isIdle } from '../dynamic.ts';
import { HAS_CHILDREN, HAS_DYNAMIC, HAS_ERRORS, HAS_INNER_LISTS } from '../features.ts';
import { added } from './blocks.ts';
import { diffPaths, getListKeys } from './diff.ts';
import { isBinding, isComment, isRecord } from './guards.ts';
import { findNode } from './nodes.ts';

interface Plan {
  /** The paths of every group. */
  readonly paths: readonly string[];
  readonly keys: Readonly<Record<string, string | undefined>>;
  /** The export names of bindings inside rows. */
  readonly rowNames: ReadonlySet<string>;
  /** The paths each binding reads, by export name. */
  readonly reads: ReadonlyMap<string, readonly string[]>;
}

/** What `patchList` gets from `patch()`. */
export interface RowContext extends ListContext {
  /**
   * True when each chosen row binding changed only through paths under its list's item, such as
   * `todos.*.done`: a kept row whose item is the same reference needs no binding run. False or
   * absent: the bindings run on every kept row.
   */
  readonly items?: boolean;
}

/** `PatchList` with the context `patch()` passes. */
export type PatchRows = (
  start: Comment,
  prev: readonly unknown[],
  next: readonly unknown[],
  context: RowContext,
) => Promise<void>;

const plans = new WeakMap<Manifest, Plan>();

function getPlan(manifest: Manifest): Plan {
  let plan = plans.get(manifest);
  if (plan === undefined) {
    const paths: string[] = [];
    const reads = new Map<string, readonly string[]>();
    for (const group of Object.values(manifest.groups)) {
      for (const path of group.paths) {
        paths.push(path);
      }
      // A group's paths are the paths of each of its bindings.
      for (const name of group.bindings) {
        reads.set(name, group.paths);
      }
    }
    const rowNames = new Set<string>();
    for (const list of Object.values(manifest.lists)) {
      for (const name of list.bindings) {
        rowNames.add(name);
      }
    }
    plan = { paths, keys: getListKeys(manifest), rowNames, reads };
    plans.set(manifest, plan);
  }
  return plan;
}

/** Returns the keys of the groups to load: changed groups in manifest order, minus covered. */
export function selectGroups(manifest: Manifest, changed: ReadonlySet<string>): string[] {
  const handled = new Set<string>();
  const selected: string[] = [];
  for (const [key, group] of Object.entries(manifest.groups)) {
    if (handled.has(key)) {
      continue;
    }
    for (const path of group.paths) {
      if (changed.has(path)) {
        selected.push(key);
        handled.add(key);
        for (const covered of group.covers) {
          handled.add(covered);
        }
        break;
      }
    }
  }
  return selected;
}

/**
 * Loads the chunks of the groups and returns their exports by name, one binding per name,
 * since covered bindings appear in several chunks.
 */
async function loadBindings(
  page: Page,
  selected: readonly string[],
): Promise<Map<string, Binding>> {
  const { manifest } = page;
  const loads: Promise<unknown>[] = [];
  for (const key of selected) {
    loads.push(page.load(manifest.module, manifest.groups[key].chunk));
  }
  const bindings = new Map<string, Binding>();
  for (const chunk of await Promise.all(loads)) {
    for (const [name, binding] of Object.entries(isRecord(chunk) ? chunk : {})) {
      if (!bindings.has(name) && isBinding(binding)) {
        bindings.set(name, binding);
      }
    }
  }
  return bindings;
}

/** Returns the ids of a list and of the lists inside its rows. */
function getBranch(manifest: Manifest, id: string): string[] {
  const ids = [id];
  for (const [other, entry] of Object.entries(manifest.lists)) {
    if (entry.parent === id) {
      ids.push(...getBranch(manifest, other));
    }
  }
  return ids;
}

function compareNames(a: string, b: string): number {
  return Number(a.slice(1)) - Number(b.slice(1));
}

function createScope(page: Page, model: Model): Scope {
  return {
    model,
    props: page.props,
    rows: [],
    ...(HAS_CHILDREN && { path: page.path }),
    ...(HAS_DYNAMIC && { dynamic: page.dynamic }),
  };
}

function readList(binding: Binding, scope: Scope): readonly unknown[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const list: unknown = (binding as ListBinding)(scope);
  return Array.isArray(list) ? list : [];
}

/**
 * Returns `patch()`, which calls `patchList` for the `<For>` blocks whose `l` binding a
 * loaded chunk exports. A chunk that holds a row binding of a list exports the list's `l`
 * too, so the row binding runs on kept rows even when the list itself did not change: on every
 * kept row, or only on those whose item changed when `items` says so.
 * `patch-lists` provides `patchList`.
 */
export function createPatch(patchList: PatchRows): Patch {
  const runPatch: Patch = async (page, prev, next) => {
    const { manifest } = page;
    const plan = getPlan(manifest);
    const paths = diffPaths(prev, next, plan.paths, plan.keys);
    const selected = selectGroups(manifest, paths);
    const changed = HAS_DYNAMIC ? getDynamic(page, prev, next, plan.keys) : [];
    if (HAS_DYNAMIC && changed.length > 0) {
      selected.push(DYNAMIC_GROUP);
    }
    if (selected.length === 0) {
      return;
    }
    const bindings = await loadBindings(page, selected);
    const names: string[] = [];
    for (const name of bindings.keys()) {
      if (!plan.rowNames.has(name) && !(HAS_DYNAMIC && isIdle(manifest, changed, name))) {
        names.push(name);
      }
    }
    // Ids follow view order, so a block runs before the bindings inside it.
    names.sort(compareNames);
    const prevScope = createScope(page, prev);
    const nextScope = createScope(page, next);
    for (const name of names) {
      if (HAS_CHILDREN && name[0] === 'p') {
        // A props binding has no node.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        (bindings.get(name) as PropBinding)(nextScope);
        continue;
      }
      const start = findNode(page.root, name, page.start);
      const binding = bindings.get(name);
      if (start === undefined || binding === undefined) {
        continue;
      }
      if (name[0] !== 'l') {
        if (HAS_ERRORS) {
          try {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            (binding as NodeBinding)(start, nextScope);
          } catch (error) {
            // A throw inside a `<Try>` swaps its region. Anywhere else it goes on to the loader.
            if (!(await failRegion(page, start, error, nextScope))) {
              throw error;
            }
          }
        } else {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          (binding as NodeBinding)(start, nextScope);
        }
        continue;
      }
      const id = name.slice(1);
      // The chosen row bindings of the list and of the lists inside its rows.
      const rows = new Map<string, Binding>();
      let items = true;
      for (const inner of getBranch(manifest, id)) {
        const list = manifest.lists[inner];
        for (const rowName of list.bindings) {
          const rowBinding = bindings.get(rowName);
          if (rowBinding === undefined) {
            continue;
          }
          rows.set(rowName, rowBinding);
          // A changed path outside the item, which is `<list>.*`. Every binding a chunk exports is
          // in a group. A list with no path reads `undefined.*.`, which no state name starts.
          for (const path of plan.reads.get(rowName)!) {
            if (paths.has(path) && !`${path}.`.startsWith(`${list.path}.*.`)) {
              items = false;
            }
          }
        }
      }
      const context: RowContext = {
        page,
        list: manifest.lists[id],
        prev: prevScope,
        next: nextScope,
        bindings: rows,
        items,
      };
      if (isComment(start)) {
        await patchList(start, readList(binding, prevScope), readList(binding, nextScope), context);
      }
    }
  };
  // The blocks a patch adds are its own: the set starts and ends empty. Patches run one at a time.
  return HAS_INNER_LISTS
    ? async (page, prev, next) => {
        added.clear();
        try {
          await runPatch(page, prev, next);
        } finally {
          added.clear();
        }
      }
    : runPatch;
}
