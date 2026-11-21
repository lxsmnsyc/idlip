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

/**
 * What turns each flag of `src/client/features.ts` on, by the name after `HAS_`. A flag is on
 * when any module of the app reports it.
 */
const DETECTORS: Readonly<Record<string, Detector>> = {
  TASKS: ({ manifest }) => manifest.tasks !== undefined,
  KEYED: hasKeyedPath,
};

/** Returns the flags that the compiled modules turn on. */
export function getFeatures(results: Iterable<CompileResult>): Set<string> {
  const on = new Set<string>();
  for (const result of results) {
    for (const [name, detect] of Object.entries(DETECTORS)) {
      if (!on.has(name) && detect(result)) {
        on.add(name);
      }
    }
  }
  return on;
}

/** Returns the source text of each feature global, `true` for a feature the app uses. */
export function getDefines(on: ReadonlySet<string>): Map<string, string> {
  const defines = new Map<string, string>();
  for (const name of Object.keys(DETECTORS)) {
    defines.set(`__IDLIP_HAS_${name}__`, String(on.has(name)));
  }
  return defines;
}

/** Returns the flags a module needs that the defines turn off. */
export function findDroppedFeatures(
  result: CompileResult,
  defines: ReadonlyMap<string, string>,
): string[] {
  const dropped: string[] = [];
  for (const name of getFeatures([result])) {
    if (defines.get(`__IDLIP_HAS_${name}__`) === 'false') {
      dropped.push(`HAS_${name}`);
    }
  }
  return dropped;
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
