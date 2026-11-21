/**
 * Runs compiled modules from memory. A module's imports of `idlip/server` and `idlip/client`
 * become reads from an object on `globalThis`, so a data URL can hold the module and the
 * loader can `import()` it.
 */

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]idlip\/(server|client)['"];?/g;

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

/** Points the module's `idlip/server` and `idlip/client` imports at `globalThis[key]`. */
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

/** What `globalThis[key]` holds while a mount runs. */
export interface Scope {
  server: Record<string, unknown>;
  client: Record<string, unknown>;
  /** Called by a chunk when it is evaluated. */
  loaded: (chunk: string) => void;
}
