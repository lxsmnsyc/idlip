// The loader's part of dynamic holes (`HAS_DYNAMIC`). The proxy that records reads is not here:
// it is in the chunk of the holes, which stores their paths in the page's `dynamic` record.
import type { Manifest, Model, Page } from '../core/format.ts';
import { diffPaths } from './patch/diff.ts';

/** The key of the group that holds the dynamic holes. */
export const DYNAMIC_GROUP = '$dynamic';

/** Returns the dynamic holes whose recorded paths changed, by binding name. */
export function getDynamic(
  page: Page,
  prev: Model,
  next: Model,
  keys: Readonly<Record<string, string | undefined>>,
): string[] {
  const names: string[] = [];
  for (const [name, paths] of Object.entries(page.dynamic ?? {})) {
    if (diffPaths(prev, next, paths, keys).size > 0) {
      names.push(name);
    }
  }
  return names;
}

/** Tells whether a binding is a dynamic hole that did not change. */
export function isIdle(manifest: Manifest, changed: readonly string[], name: string): boolean {
  return manifest.groups[DYNAMIC_GROUP]?.bindings.includes(name) && !changed.includes(name);
}
