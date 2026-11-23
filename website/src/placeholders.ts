import type { DemoData, DemoFile } from './demo/data.ts';

/** The text a size placeholder shows when the page renders without the demo build. */
const UNMEASURED = 'n/a';

/** A placeholder starts with `demo.`, so the `{{` of a JSX object in a code sample stays text. */
const PLACEHOLDER = /\{\{(demo\.[^{}\s]*)\}\}/g;

/** The names of the measured files, as `DemoData` has them. */
const FILES = ['document', 'listener', 'loader', 'handler', 'helpers', 'binding'] as const;

/** The names a placeholder may have: `demo.<file>.<raw|gzip>` and the two totals. */
const NAMES = new Set<string>();
for (const name of [...FILES, 'load', 'click']) {
  NAMES.add(`demo.${name}.raw`);
  NAMES.add(`demo.${name}.gzip`);
}

function sumFiles(files: readonly DemoFile[], field: 'raw' | 'gzip'): number {
  let total = 0;
  for (const file of files) {
    total += file[field];
  }
  return total;
}

/**
 * The sizes a docs page may use, by name, in bytes as `4787 B`: `demo.<file>.raw` and
 * `demo.<file>.gzip` for `document`, `listener`, `loader`, `handler`, `helpers` and `binding`.
 * `demo.load` is the document and the loader, the requests before the first event. `demo.click`
 * is the requests of the first click. Raw is the size as served, gzip is zlib level 9.
 */
export function listSizes(demo: DemoData): Map<string, string> {
  const sizes = new Map<string, string>();
  function add(name: string, raw: number, gzip: number): void {
    sizes.set(`demo.${name}.raw`, `${raw} B`);
    sizes.set(`demo.${name}.gzip`, `${gzip} B`);
  }
  for (const name of FILES) {
    const file = demo[name];
    if (file !== undefined) {
      add(name, file.raw, file.gzip);
    }
  }
  const load = [demo.document, demo.loader];
  add('load', sumFiles(load, 'raw'), sumFiles(load, 'gzip'));
  const click = demo.helpers
    ? [demo.handler, demo.helpers, demo.binding]
    : [demo.handler, demo.binding];
  add('click', sumFiles(click, 'raw'), sumFiles(click, 'gzip'));
  return sizes;
}

/**
 * Replaces every `{{demo.<file>.<raw|gzip>}}` of a Markdown page with the measured size. A name
 * that is not in the list is an error, so a rename fails the build instead of leaving text.
 * Without `demo`, the names are still checked and the sizes read `n/a`.
 */
export function fillPlaceholders(text: string, file: string, demo?: DemoData): string {
  const sizes = demo === undefined ? undefined : listSizes(demo);
  return text.replaceAll(PLACEHOLDER, (match, name: string) => {
    if (!NAMES.has(name)) {
      throw new Error(
        `${file}: unknown placeholder ${match}. Names: ${[...NAMES].toSorted().join(', ')}.`,
      );
    }
    if (sizes === undefined) {
      return UNMEASURED;
    }
    const size = sizes.get(name);
    if (size === undefined) {
      throw new Error(`${file}: the demo build has no value for ${match}.`);
    }
    return size;
  });
}
