import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/** A dependency of the app that publishes idlip components as source. */
export interface IdlipPackage {
  /** The name in `package.json`, such as `@acme/ui`. */
  name: string;
  /** The real folder of the package, as a posix path. */
  dir: string;
  /** The real folder that holds its components, as a posix path: `dir` of the `idlip` field. */
  src: string;
}

/** The only format of the `idlip` field this version reads. */
const FORMAT = 1;

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

function readJson(file: string): Record<string, unknown> | undefined {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

/** Finds a dependency the way Node does: `node_modules` of the root, then of each parent folder. */
function findDependency(root: string, name: string): string | undefined {
  for (let current = root; ; current = path.dirname(current)) {
    const dir = path.join(current, 'node_modules', name);
    if (existsSync(path.join(dir, 'package.json'))) {
      return realpathSync(dir);
    }
    if (path.dirname(current) === current) {
      return undefined;
    }
  }
}

/** Reads one `idlip` field. Returns `undefined` when the value is not an object. */
function readField(name: string, dir: string, field: unknown): IdlipPackage | undefined {
  if (typeof field !== 'object' || field === null || Array.isArray(field)) {
    return undefined;
  }
  const version: unknown = Reflect.get(field, 'version');
  if (version !== FORMAT) {
    throw new Error(
      `${name} uses idlip package format ${String(version)}; this idlip reads format ${FORMAT}.`,
    );
  }
  const folder: unknown = Reflect.get(field, 'dir');
  const src = path.resolve(dir, typeof folder === 'string' ? folder : '.');
  const relative = path.relative(dir, src);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${name} sets idlip.dir outside the package: ${String(folder)}.`);
  }
  return { name, dir: toPosix(dir), src: toPosix(src) };
}

/**
 * Lists the direct dependencies of the app whose `package.json` has an `idlip` field, resolved
 * from the app root. A linked package, such as one of a workspace, is read at its real folder.
 * Throws when a field names a format this idlip does not read.
 */
export function readPackages(root: string): IdlipPackage[] {
  const app = readJson(path.join(root, 'package.json'));
  const names = new Set<string>();
  for (const key of ['dependencies', 'devDependencies']) {
    const group = app?.[key];
    if (typeof group === 'object' && group !== null) {
      for (const name of Object.keys(group)) {
        names.add(name);
      }
    }
  }
  const found: IdlipPackage[] = [];
  for (const name of [...names].toSorted()) {
    const dir = findDependency(root, name);
    const json = dir === undefined ? undefined : readJson(path.join(dir, 'package.json'));
    if (dir === undefined || json === undefined) {
      continue;
    }
    const info = readField(name, dir, json.idlip);
    if (info !== undefined) {
      found.push(info);
    }
  }
  return found;
}

/** Lists the `.tsx` files of a package's source folder, as absolute posix paths. */
export function listPackageFiles(info: IdlipPackage): string[] {
  const files: string[] = [];
  for (const name of globSync('**/*.tsx', {
    cwd: info.src,
    exclude: ['**/node_modules/**', '**/.*/**'],
  })) {
    files.push(toPosix(path.resolve(info.src, name)));
  }
  return files;
}

/**
 * Finds the package that holds a file: the one with the longest folder, unless the file sits in a
 * `node_modules` folder inside it.
 */
export function findPackage(
  packages: readonly IdlipPackage[],
  file: string,
): IdlipPackage | undefined {
  let best: IdlipPackage | undefined;
  for (const info of packages) {
    if (
      file.startsWith(`${info.dir}/`) &&
      !file.slice(info.dir.length).includes('/node_modules/') &&
      (best === undefined || info.dir.length > best.dir.length)
    ) {
      best = info;
    }
  }
  return best;
}

/** The module id of a package file: the package name and the path in it, `@acme/ui/src/button.tsx`. */
export function getPackageId(info: IdlipPackage, file: string): string {
  return `${info.name}/${file.slice(info.dir.length + 1)}`;
}

/** The file of a package module id, or `undefined` when the id is not one of a package. */
export function getPackageFile(packages: readonly IdlipPackage[], id: string): string | undefined {
  for (const info of packages) {
    if (id.startsWith(`${info.name}/`)) {
      return `${info.dir}/${id.slice(info.name.length + 1)}`;
    }
  }
  return undefined;
}

/** The part of a chunk name that tells packages apart: `@acme/ui` is `acme-ui`. */
export function getPackageSlug(info: IdlipPackage): string {
  return info.name.replace(/^@/, '').replaceAll('/', '-');
}
