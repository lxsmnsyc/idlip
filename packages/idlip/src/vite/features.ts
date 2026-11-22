import { listCompiled } from '../core/format.ts';
import type { CompileResult } from '../core/format.ts';

type Detector = (result: CompileResult) => boolean;

function hasKeyedPath({ manifest }: CompileResult): boolean {
  for (const group of Object.values(manifest.groups)) {
    for (const path of group.paths) {
      if (path.includes('[')) {
        return true;
      }
    }
  }
  return false;
}

function hasKeyFunction({ manifest }: CompileResult): boolean {
  for (const list of Object.values(manifest.lists)) {
    if (list.key === undefined) {
      return true;
    }
  }
  return false;
}

function hasInnerLists({ client }: CompileResult): boolean {
  // A list's start marker in a chunk's markup: a branch, a region or a row renders the list.
  for (const module of client) {
    if (/<!--l\d/.test(module.code)) {
      return true;
    }
  }
  return false;
}

function hasChildren({ manifest, server }: CompileResult): boolean {
  // The child has a `view` chunk. A parent has `uses`, even when the child is not compiled as one.
  // A component other than the main one sets the `uses` of its record, `$Name.uses = [...]`.
  return manifest.view !== undefined || /^(?:export const uses =|\$[^\s.]+\.uses = )/m.test(server);
}

/**
 * What turns each flag of `src/client/features.ts` on, by the name after `HAS_`. A flag is on
 * when any module of the app reports it.
 */
const DETECTORS: Readonly<Record<string, Detector>> = {
  TASKS: ({ manifest }) => manifest.tasks !== undefined,
  KEYED: hasKeyedPath,
  REFS: ({ manifest }) => manifest.after === true,
  CHILDREN: hasChildren,
  SUBS: ({ manifest }) => manifest.sources !== undefined,
  HEAD: ({ manifest }) => manifest.head === true,
  ERRORS: ({ manifest }) => manifest.fallback !== undefined,
  // `deploy-skew` turns this on for apps without `<Try>` too.
  RETRY: ({ manifest }) => manifest.fallback !== undefined,
  DYNAMIC: ({ manifest }) => Object.hasOwn(manifest.groups, '$dynamic'),
  KEY_FN: hasKeyFunction,
  INNER_LISTS: hasInnerLists,
};

/** Returns the flags that the compiled modules turn on. */
export function getFeatures(results: Iterable<CompileResult>): Set<string> {
  const on = new Set<string>();
  // Each component of a file is checked with its own manifest.
  for (const result of results) {
    for (const component of listCompiled(result)) {
      const one: CompileResult = { ...result, ...component };
      for (const [name, detect] of Object.entries(DETECTORS)) {
        if (!on.has(name) && detect(one)) {
          on.add(name);
        }
      }
    }
  }
  return on;
}

/** Returns the source text of each feature global, `true` for a feature the app uses and for `skew`. */
export function getDefines(on: ReadonlySet<string>, skew = true): Map<string, string> {
  const defines = new Map<string, string>();
  for (const name of Object.keys(DETECTORS)) {
    defines.set(`__IDLIP_HAS_${name}__`, String(on.has(name)));
  }
  // SKEW is an option of the plugin, not something a module reports.
  defines.set('__IDLIP_HAS_SKEW__', String(skew));
  return defines;
}

/** Replaces the feature globals in a module, or returns undefined when it names none. */
export function replaceFeatures(
  code: string,
  defines: ReadonlyMap<string, string>,
): { code: string; map: null } | undefined {
  if (!code.includes('__IDLIP_HAS_')) {
    return undefined;
  }
  let result = code;
  for (const [name, value] of defines) {
    // The declaration in the TypeScript source of the loader stays, since it is not an use.
    result = result.replaceAll(new RegExp(`(?<!declare const )${name}`, 'g'), value);
  }
  // The map is null: each name becomes a literal on the same line, so lines stay as they were.
  return result === code ? undefined : { code: result, map: null };
}
