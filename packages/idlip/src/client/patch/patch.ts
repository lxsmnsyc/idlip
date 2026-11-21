import type {
  Binding,
  ListBinding,
  ListContext,
  Manifest,
  Model,
  NodeBinding,
  Page,
  Patch,
  PatchList,
  PropBinding,
  Scope,
} from '../../core/format.ts';
import { failRegion } from '../errors.ts';
import { DYNAMIC_GROUP, getDynamic, isIdle } from '../dynamic.ts';
import { HAS_CHILDREN, HAS_DYNAMIC, HAS_ERRORS } from '../features.ts';
import { diffPaths, getListKeys } from './diff.ts';
import { isBinding, isComment, isRecord } from './guards.ts';
import { findNode } from './nodes.ts';

interface Plan {
  /** The paths of every group. */
  readonly paths: readonly string[];
  readonly keys: Readonly<Record<string, string>>;
  /** The export names of bindings inside rows. */
  readonly rowNames: ReadonlySet<string>;
}

const plans = new WeakMap<Manifest, Plan>();

function getPlan(manifest: Manifest): Plan {
  let plan = plans.get(manifest);
  if (plan === undefined) {
    const paths: string[] = [];
    for (const group of Object.values(manifest.groups)) {
      for (const path of group.paths) {
        paths.push(path);
      }
    }
    const rowNames = new Set<string>();
    for (const list of Object.values(manifest.lists)) {
      for (const name of list.bindings) {
        rowNames.add(name);
      }
    }
    plan = { paths, keys: getListKeys(manifest), rowNames };
    plans.set(manifest, plan);
  }
  return plan;
}

/** Returns the keys of the groups to load: changed groups in manifest order, minus covered. */
export function selectGroups(manifest: Manifest, plan: Plan, prev: Model, next: Model): string[] {
  const changed = diffPaths(prev, next, plan.paths, plan.keys);
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
 * too, so the row binding runs on every kept row even when the list itself did not change.
 * `patch-lists` provides `patchList`.
 */
export function createPatch(patchList: PatchList): Patch {
  return async (page, prev, next) => {
    const { manifest } = page;
    const plan = getPlan(manifest);
    const selected = selectGroups(manifest, plan, prev, next);
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
      for (const inner of getBranch(manifest, id)) {
        for (const rowName of manifest.lists[inner].bindings) {
          const rowBinding = bindings.get(rowName);
          if (rowBinding !== undefined) {
            rows.set(rowName, rowBinding);
          }
        }
      }
      const context: ListContext = {
        page,
        list: manifest.lists[id],
        prev: prevScope,
        next: nextScope,
        bindings: rows,
      };
      if (isComment(start)) {
        await patchList(start, readList(binding, prevScope), readList(binding, nextScope), context);
      }
    }
  };
}
