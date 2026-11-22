/**
 * Runs compiled modules from memory. A module's imports of `idlip/server`, `idlip/client` and
 * `idlip/helpers` become reads from an object on `globalThis`, so a data URL can hold the module and the
 * loader can `import()` it.
 */
import { printHelpersModule } from '../core/helpers.ts';

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]idlip\/(server|client|helpers)['"];?/g;

function toPattern(specifiers: string): string {
  const names: string[] = [];
  for (const part of specifiers.split(',')) {
    const pieces = part.trim().split(/\s+as\s+/);
    const name = pieces[0];
    const alias = pieces.at(1);
    if (name !== '') {
      names.push(alias === undefined ? name : `${name}: ${alias}`);
    }
  }
  return names.join(', ');
}

/** Points the module's `idlip/server`, `idlip/client` and `idlip/helpers` imports at `globalThis[key]`. */
export function bindImports(code: string, key: string): string {
  return code.replaceAll(
    IMPORT,
    (_all, specifiers: string, scope: string) =>
      `const { ${toPattern(specifiers)} } = globalThis[${JSON.stringify(key)}].${scope};`,
  );
}

export function toDataUrl(code: string): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

/**
 * Runs the `idlip/helpers` module a build serves, bound to `globalThis[key].client`, and returns
 * its exports for `globalThis[key].helpers`.
 */
export async function importHelpers(key: string): Promise<Record<string, unknown>> {
  const module: unknown = await import(
    /* @vite-ignore */ toDataUrl(bindImports(printHelpersModule(), key))
  );
  const exports: Record<string, unknown> = {};
  const namespace = typeof module === 'object' && module !== null ? module : {};
  for (const [name, value] of Object.entries(namespace)) {
    exports[name] = value;
  }
  return exports;
}

/** What `globalThis[key]` holds while a mount runs. */
export interface Scope {
  server: Record<string, unknown>;
  client: Record<string, unknown>;
  helpers: Record<string, unknown>;
  /** The server modules of the children, by the specifier a module imports them with. */
  modules?: Record<string, unknown>;
  /** Called by a chunk when it is evaluated. */
  loaded: (chunk: string) => void;
}
