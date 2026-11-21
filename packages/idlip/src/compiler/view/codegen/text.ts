// String helpers for the code generator: JS literals, HTML escaping and template literals.

/** A piece of generated markup: fixed text, or JS code whose value is a string. */
export type Part = { kind: 'text'; value: string } | { kind: 'code'; value: string };

const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x2029);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const INTEGER = /^(?:0|[1-9]\d*)$/;

/** Names a generated local never takes: JS words and the names the generated code uses. */
const RESERVED = new Set([
  'props',
  'context',
  'manifest',
  'chunks',
  'model',
  'rows',
  'el',
  'start',
  'branch',
  'render',
  'text$',
  'attr$',
  'on$',
  'setAttr$',
  'setText$',
  'setOn$',
  'setBranch$',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'undefined',
]);

/** Returns a JS identifier for a source name, adding `$` when the name is taken. */
export function getLocalName(name: string): string {
  return RESERVED.has(name) ? `${name}$` : name;
}

/** Returns a single-quoted JS string literal. */
export function quote(value: string): string {
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll(LINE_SEPARATOR, '\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\u2029');
  return `'${escaped}'`;
}

/** Returns `.name`, `[0]` or `['a-b']`, or the same with `?.` when `optional` is set. */
export function getAccessor(name: string, optional: boolean): string {
  if (IDENTIFIER.test(name)) {
    return optional ? `?.${name}` : `.${name}`;
  }
  const key = INTEGER.test(name) ? name : quote(name);
  return optional ? `?.[${key}]` : `[${key}]`;
}

/** Returns an object literal key. */
export function getKey(name: string): string {
  return IDENTIFIER.test(name) || INTEGER.test(name) ? name : quote(name);
}

/** Escapes text for HTML content, as `text()` does at run time. */
export function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Escapes a value for a double-quoted attribute. */
export function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

/** Escapes a value for a single-quoted attribute, as `on()` does at run time. */
export function escapeSingleQuoted(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll("'", '&#39;');
}

/** Returns a JS literal for a JSON-like value. */
export function toLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value as unknown[]) {
      items.push(toLiteral(item));
    }
    return `[${items.join(', ')}]`;
  }
  const entries: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    entries.push(`${getKey(key)}: ${toLiteral(item)}`);
  }
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

/** Joins parts into one JS expression: a string literal, or a template literal. */
export function joinParts(parts: readonly Part[]): string {
  // Merge neighbouring text.
  const merged: Part[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (part.kind === 'text') {
      if (part.value === '') {
        continue;
      }
      if (last?.kind === 'text') {
        merged[merged.length - 1] = { kind: 'text', value: last.value + part.value };
        continue;
      }
    }
    merged.push(part);
  }
  if (merged.length === 0) {
    return "''";
  }
  if (merged.length === 1) {
    const only = merged[0];
    return only.kind === 'text' ? quote(only.value) : only.value;
  }
  let out = '`';
  for (const part of merged) {
    if (part.kind === 'code') {
      out += `\${${part.value}}`;
    } else {
      out += part.value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
    }
  }
  return `${out}\``;
}

/** Prints the import of runtime helpers. Each is imported as `name$`, so no local clashes. */
export function printHelperImport(names: ReadonlySet<string>, source: string): string {
  if (names.size === 0) {
    return '';
  }
  const specifiers: string[] = [];
  for (const name of [...names].sort()) {
    specifiers.push(`${name} as ${name}$`);
  }
  return `import { ${specifiers.join(', ')} } from ${quote(source)};`;
}
