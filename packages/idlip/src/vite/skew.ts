import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The key of the build id in the chunk URL map. Chunk ids start with `/`, so none collides. */
export const BUILD_KEY = 'build';

/** The module next to the loader that exports the build id. The loader imports it. */
export const BUILD_FILE = 'build.js';

/** Returns the file of the loader: the first entry that is not an idlip chunk. */
export function findLoaderFile(
  bundle: Readonly<Record<string, { type: string; isEntry?: boolean }>>,
  chunkFiles: ReadonlySet<string>,
): string {
  for (const [file, item] of Object.entries(bundle)) {
    if (item.type === 'chunk' && item.isEntry === true && !chunkFiles.has(file)) {
      return file;
    }
  }
  return BUILD_FILE;
}

/**
 * Returns the text of `build.js`: the build id as the default export, and the check that the
 * loader runs after a chunk fails. The check reloads the page once for each build that the tab
 * leaves. The state of a build is `fresh` (absent) or `reloaded`, kept in `sessionStorage`.
 */
export function getBuildSource(id: string): string {
  return `export default '${id}';
export function check() {
  const page = document.querySelector('[i-build]')?.getAttribute('i-build');
  try {
    const states = JSON.parse(sessionStorage.getItem('idlip:builds') ?? '{}');
    if (page && page !== '${id}' && states[page] !== 'reloaded') {
      states[page] = 'reloaded';
      sessionStorage.setItem('idlip:builds', JSON.stringify(states));
      location.reload();
    }
  } catch {}
}
`;
}

/** The files of each kept build, oldest first, under `build.outDir` and outside the client folder. */
export const BUILDS_FILE = '.idlip/builds.json';

/** A build that a client folder still holds. */
export interface KeptBuild {
  readonly id: string;
  /** The files of the build, relative to the client folder. */
  readonly files: readonly string[];
}

/** Returns the id of a build: a hash of its file names, which hold the content hashes. */
export function getBuildId(files: Iterable<string>): string {
  return createHash('sha256')
    .update([...files].toSorted().join('\n'))
    .digest('hex')
    .slice(0, 8);
}

function isKeptBuild(value: unknown): value is KeptBuild {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    Array.isArray(Reflect.get(value, 'files'))
  );
}

/** Reads the kept builds. A missing or broken record means none are kept. */
export function readBuilds(file: string): KeptBuild[] {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(value) && value.every((item) => isKeptBuild(item))) {
      return value;
    }
  } catch {
    // No record yet.
  }
  return [];
}

/**
 * Records a finished build and deletes the files of the builds before the previous one. The
 * previous build stays whole, so a page cached from it still finds its chunks. A file that the
 * current or the previous build also holds stays, since a content hash names it in both.
 */
export function keepBuilds(recordFile: string, clientDir: string, build: KeptBuild): void {
  const kept = readBuilds(recordFile).filter((item) => item.id !== build.id);
  const previous = kept.at(-1);
  const live = new Set([...build.files, ...(previous?.files ?? [])]);
  for (const old of kept.slice(0, -1)) {
    for (const file of old.files) {
      if (!live.has(file)) {
        rmSync(path.join(clientDir, file), { force: true });
      }
    }
  }
  const next = previous === undefined ? [build] : [previous, build];
  mkdirSync(path.dirname(recordFile), { recursive: true });
  writeFileSync(recordFile, JSON.stringify(next));
}
