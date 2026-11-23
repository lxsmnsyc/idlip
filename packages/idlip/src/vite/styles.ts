import { parseSync } from 'oxc-parser';

/** A stylesheet that Vite processes: plain CSS, its preprocessors and PostCSS files. */
const STYLE_FILE = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)(?:\?.*)?$/;

/** A CSS Module: its class names are scoped to the file, and the import is an object of them. */
const STYLE_MODULE = /\.module\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)(?:\?.*)?$/;

/** A source file whose imports the walk reads. */
const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** The key of a built chunk map that holds the stylesheet URLs of a module file. */
export const STYLES_PREFIX = 'styles:';

/** Whether the id is a stylesheet. */
export function isStyle(id: string): boolean {
  return STYLE_FILE.test(id);
}

/** Whether the id is a CSS Module. */
export function isStyleModule(id: string): boolean {
  return STYLE_MODULE.test(id);
}

/**
 * Whether the walk reads the file's imports: a script outside `node_modules`, or a script of an
 * idlip package (`inPackage`), which is installed there.
 */
export function isScript(id: string, inPackage = false): boolean {
  return SCRIPT_FILE.test(id) && (inPackage || !id.includes('/node_modules/'));
}

/** Returns the id without its query. */
export function cleanId(id: string): string {
  const query = id.indexOf('?');
  return query < 0 ? id : id.slice(0, query);
}

/**
 * Lists the specifiers a file imports or re-exports, in source order. Type-only imports are left
 * out, since they do not exist at run time.
 */
export function listImports(file: string, source: string): string[] {
  const specifiers: string[] = [];
  for (const statement of parseSync(file, source).program.body) {
    if (statement.type === 'ImportDeclaration') {
      if (statement.importKind !== 'type') {
        specifiers.push(statement.source.value);
      }
    } else if (
      (statement.type === 'ExportAllDeclaration' || statement.type === 'ExportNamedDeclaration') &&
      statement.source !== null &&
      statement.exportKind !== 'type'
    ) {
      specifiers.push(statement.source.value);
    }
  }
  return specifiers;
}
