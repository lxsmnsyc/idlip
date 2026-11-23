// oxlint-disable import/prefer-default-export
// Joins the event functions of the view into the handler chunks. An event function is an export
// of the chunk of the first handler it sends, so a click loads one chunk for both.
import type { Manifest, Module } from '../core/format.ts';
import type { SiteModule } from './view/codegen/index.ts';

const IMPORT = /^import [^;]*;\n?/gm;
const DECLARATION = /^(?:function|const)\s+([\w$]+)/;

/** The parts of an import statement: the default name, the specifiers and the source text. */
interface ParsedImport {
  head: string;
  specifiers: string[];
  from: string;
}

function parseImport(statement: string): ParsedImport {
  const text = statement.trim().replace(/;$/, '');
  const open = text.indexOf('{');
  const close = text.indexOf('}');
  const from = text.slice(text.lastIndexOf(' from ') + ' from '.length);
  const head = text
    .slice('import'.length, open === -1 ? text.lastIndexOf(' from ') : open)
    .replace(',', '')
    .trim();
  const specifiers: string[] = [];
  if (open !== -1) {
    for (const part of text.slice(open + 1, close).split(',')) {
      if (part.trim() !== '') {
        specifiers.push(part.trim());
      }
    }
  }
  return { head, specifiers, from };
}

/** The local name that a specifier such as `a as b` binds. */
function getLocal(specifier: string): string {
  return specifier.split(/\s+as\s+/).at(-1) ?? specifier;
}

/** Lists the local names that the import statements of a chunk bind. */
function listLocals(imports: readonly string[]): Set<string> {
  const locals = new Set<string>();
  for (const statement of imports) {
    const parsed = parseImport(statement);
    if (parsed.head !== '') {
      locals.add(parsed.head);
    }
    for (const specifier of parsed.specifiers) {
      locals.add(getLocal(specifier));
    }
  }
  return locals;
}

/** Keeps the parts of an import that the chunk does not bind yet. */
function dropBound(statement: string, bound: ReadonlySet<string>): string | undefined {
  const parsed = parseImport(statement);
  const kept: string[] = [];
  for (const specifier of parsed.specifiers) {
    if (!bound.has(getLocal(specifier))) {
      kept.push(specifier);
    }
  }
  const head = parsed.head !== '' && !bound.has(parsed.head) ? parsed.head : '';
  if (head === '' && kept.length === 0) {
    return undefined;
  }
  const names = kept.length === 0 ? '' : `{ ${kept.join(', ')} }`;
  return `import ${[head, names].filter(Boolean).join(', ')} from ${parsed.from};\n`;
}

/** Tells whether the chunk declares a name at its top level. */
function hasDeclaration(code: string, name: string): boolean {
  const escaped = name.replaceAll('$', String.raw`\$`);
  return new RegExp(`(?:function|const|let|class)\\s+${escaped}\\b`).test(code);
}

/** Adds one event function to the code of a handler chunk. */
function appendSite(handler: string, site: string): string {
  const handlerImports = handler.match(IMPORT) ?? [];
  const bound = listLocals(handlerImports);
  const imports: string[] = [];
  for (const statement of site.match(IMPORT) ?? []) {
    const kept = dropBound(statement, bound);
    if (kept !== undefined) {
      imports.push(kept);
      for (const name of listLocals([kept])) {
        bound.add(name);
      }
    }
  }
  // A block of the site that the chunk declares already is the same module-level helper.
  const blocks: string[] = [];
  for (const block of site.replace(IMPORT, '').trim().split('\n\n')) {
    const name = DECLARATION.exec(block)?.[1];
    if (name === undefined || !hasDeclaration(handler, name)) {
      blocks.push(block);
    }
  }
  const last = handlerImports.at(-1);
  const at = last === undefined ? 0 : handler.indexOf(last) + last.length;
  return `${handler.slice(0, at)}${imports.join('')}${handler.slice(at)}\n${blocks.join('\n\n')}\n`;
}

/**
 * Appends each event function to the handler chunk named by the manifest. A function whose
 * handler has no chunk in the list is dropped.
 */
export function joinSites(
  handlers: readonly Module[],
  sites: readonly SiteModule[],
  manifest: Manifest,
): Module[] {
  const out: Module[] = [...handlers];
  for (const site of sites) {
    const chunk = manifest.handlers[site.tag]?.chunk;
    for (const [index, module] of out.entries()) {
      if (module.chunk === chunk) {
        out[index] = { ...module, code: appendSite(module.code, site.code) };
      }
    }
  }
  return out;
}
