// Picks the components of a file that get their own manifest, chunks and server render
// function, and names each one's module id.
import { parseSync } from 'oxc-parser';
import type { Node as AstNode, Program } from '@oxc-project/types';
import type { CompileDiagnostic } from '../../../core/format.ts';
import { pickComponent } from '../../update/index.ts';
import type { Component, ModuleIR } from '../analyze/index.ts';

/** One component that compiles to its own manifest, chunks and render function. */
export interface Selected {
  component: Component;
  /** The module id: the file id for the main component, `<file>#<Name>` for the others. */
  module: string;
  /** True for the main component, which the server module exports as `default`. */
  main: boolean;
  /** True when the source exports the component, so other files can import it. */
  exported: boolean;
  /** True when a module renders it as a child, so it gets a `view` chunk. */
  child: boolean;
}

export interface SelectOptions {
  /** True when another module renders the main component as a child. */
  child?: boolean;
  /** The names of the named components that other modules render as children. */
  children?: readonly string[];
}

/** What the file exports, read from its statements. */
interface Exports {
  /** The local name of the default export, when it is a component. */
  main: string | undefined;
  /** The local names of the components exported by name. */
  named: Set<string>;
  /** Every module-level function declaration by name. */
  nodes: Map<string, AstNode>;
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

/** Whether a node holds JSX anywhere inside it. */
function hasJsx(node: AstNode): boolean {
  const stack: AstNode[] = [node];
  for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
    if (current.type === 'JSXElement' || current.type === 'JSXFragment') {
      return true;
    }
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const item of value as unknown[]) {
          if (isAstNode(item)) {
            stack.push(item);
          }
        }
      } else if (isAstNode(value)) {
        stack.push(value);
      }
    }
  }
  return false;
}

function isFunctionValue(node: AstNode | null | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

/** Reads the exports of the file and reports the component forms the compiler does not read. */
function readExports(
  program: Program,
  components: ReadonlySet<string>,
  report: (rule: string, message: string, node: AstNode) => void,
): Exports {
  const exports: Exports = { main: undefined, named: new Set(), nodes: new Map() };
  const formMessage = (name: string): string =>
    `${name} is a function value. Write the component as a function declaration: \`function ${name}(props) { … }\``;
  // An exported function that returns JSX under a name that is not capitalized.
  const checkName = (node: AstNode & { id: { name: string } | null }): boolean => {
    const name = node.id?.name ?? '';
    if (/^[A-Z]/.test(name) || !hasJsx(node)) {
      return true;
    }
    const bare = name.replace(/^[^A-Za-z]+/, '');
    const fixed = bare === '' ? 'App' : `${bare.slice(0, 1).toUpperCase()}${bare.slice(1)}`;
    report(
      'component-name',
      `${name} returns JSX, but a component name starts with a capital letter. Rename it, such as \`${fixed}\``,
      node,
    );
    return false;
  };

  for (const statement of program.body) {
    // Each function declaration by name, for the spans of the diagnostics.
    const inner =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement;
    if (inner?.type === 'FunctionDeclaration' && inner.id !== null) {
      exports.nodes.set(inner.id.name, inner);
    }

    // `export default function App`, `export default App`, and an anonymous default.
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration;
      if (declaration.type === 'FunctionDeclaration' && declaration.id !== null) {
        if (checkName(declaration)) {
          exports.main = declaration.id.name;
        }
      } else if (declaration.type === 'Identifier' && components.has(declaration.name)) {
        exports.main = declaration.name;
      } else if (
        (declaration.type === 'FunctionDeclaration' || isFunctionValue(declaration)) &&
        hasJsx(declaration)
      ) {
        report(
          'component-form',
          'The default export is a component without a name. Name it: `export default function App(props) { … }`',
          declaration,
        );
      }
      continue;
    }

    // `export function Counter`, `export { Counter }`, and `const Counter = () => …`.
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (statement.type === 'ExportNamedDeclaration') {
      if (declaration?.type === 'FunctionDeclaration' && declaration.id !== null) {
        if (components.has(declaration.id.name)) {
          exports.named.add(declaration.id.name);
        } else {
          checkName(declaration);
        }
      }
      if (statement.source === null) {
        for (const specifier of statement.specifiers) {
          const local = specifier.local.type === 'Identifier' ? specifier.local.name : '';
          const exported =
            specifier.exported.type === 'Literal'
              ? specifier.exported.value
              : specifier.exported.name;
          if (!components.has(local)) {
            continue;
          }
          if (exported === 'default') {
            exports.main = local;
          } else if (exported === local) {
            exports.named.add(local);
          } else {
            report(
              'component-export',
              `${local} is exported as ${exported}. Export a component under its own name, since the name is part of its chunk names`,
              specifier,
            );
          }
        }
      }
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (
          declarator.id.type === 'Identifier' &&
          /^[A-Z]/.test(declarator.id.name) &&
          isFunctionValue(declarator.init) &&
          declarator.init !== null &&
          hasJsx(declarator.init)
        ) {
          report('component-form', formMessage(declarator.id.name), declarator);
        }
      }
    }
  }
  return exports;
}

/** Lists the names of the components of the file that a view renders as stateful children. */
function listLocalChildren(component: Component, names: ReadonlySet<string>): string[] {
  const found: string[] = [];
  const seen = new Set<object>();
  const stack: unknown[] = [component.view];
  // A field may hold `undefined`, so the loop runs on the stack's length.
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== 'object' || current === null || seen.has(current)) {
      continue;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      stack.push(...(current as unknown[]));
      continue;
    }
    const root: unknown = Reflect.get(current, 'component');
    const name: unknown =
      typeof root === 'object' && root !== null && Reflect.get(root, 'kind') === 'module'
        ? Reflect.get(root, 'name')
        : undefined;
    if (
      Reflect.get(current, 'kind') === 'child' &&
      typeof name === 'string' &&
      names.has(name) &&
      !found.includes(name)
    ) {
      found.push(name);
    }
    const values: unknown[] = Object.values(current);
    stack.push(...values);
  }
  return found;
}

/**
 * Picks the components that compile: the default export, every component exported by name,
 * and every other component that one of them renders as a stateful child, in source order.
 * A file with no exported component keeps the old rule: its first stateful component is the
 * main one. The main component has the file's id. Every other one adds `#<Name>`.
 */
export function selectComponents(
  ir: ModuleIR,
  source: string,
  id: string,
  options: SelectOptions = {},
): { selected: Selected[]; diagnostics: CompileDiagnostic[] } {
  const diagnostics: CompileDiagnostic[] = [];
  const report = (rule: string, message: string, node: AstNode): void => {
    diagnostics.push({
      rule,
      severity: 'error',
      message,
      span: { start: node.start, end: node.end },
    });
  };
  const byName = new Map<string, Component>();
  for (const component of ir.components) {
    byName.set(component.name, component);
  }
  const program = parseSync(ir.file, source, { lang: 'tsx' }).program;
  const exports = readExports(program, new Set(byName.keys()), report);
  const findSpan = (name: string): { start: number; end: number } => {
    const node = exports.nodes.get(name);
    return node === undefined ? { start: 0, end: 0 } : { start: node.start, end: node.end };
  };

  // Two names that differ only in case would give chunk files that differ only in case.
  const lower = new Map<string, string>();
  for (const component of ir.components) {
    const key = component.name.toLowerCase();
    const other = lower.get(key);
    if (other !== undefined) {
      diagnostics.push({
        rule: 'component-duplicate',
        severity: 'error',
        message:
          other === component.name
            ? `The file declares the component ${other} twice`
            : `The components ${other} and ${component.name} differ only in case, so their chunk files would collide on a case-insensitive file system`,
        span: findSpan(component.name),
      });
    }
    lower.set(key, component.name);
  }
  if (exports.main !== undefined && exports.named.has(exports.main)) {
    diagnostics.push({
      rule: 'component-export',
      severity: 'error',
      message: `${exports.main} is both the default export and a named export. Export it once`,
      span: findSpan(exports.main),
    });
  }
  if (diagnostics.length > 0) {
    return { selected: [], diagnostics };
  }

  // The main component, then every exported one, then what they render, until nothing is new.
  let main = exports.main;
  if (main === undefined && exports.named.size === 0) {
    main = (pickComponent(ir) ?? ir.components.at(0))?.name;
  }
  const picked = new Set<string>();
  const rendered = new Set<string>();
  const queue: string[] = [];
  if (main !== undefined) {
    queue.push(main);
  }
  queue.push(...exports.named);
  for (let index = 0; index < queue.length; index++) {
    const name = queue[index];
    const component = byName.get(name);
    if (component === undefined || picked.has(name)) {
      continue;
    }
    picked.add(name);
    for (const child of listLocalChildren(component, new Set(byName.keys()))) {
      rendered.add(child);
      queue.push(child);
    }
  }

  // Source order, with the main component first.
  const selected: Selected[] = [];
  for (const component of ir.components) {
    if (!picked.has(component.name)) {
      if (component.mode === 'stateful') {
        diagnostics.push({
          rule: 'component-unused',
          severity: 'warning',
          message: `${component.name} is neither exported nor rendered by an exported component, so it is not compiled`,
          span: findSpan(component.name),
        });
      }
      continue;
    }
    const isMain = component.name === main;
    const exported = isMain || exports.named.has(component.name);
    const child =
      rendered.has(component.name) ||
      (isMain ? options.child === true : options.children?.includes(component.name) === true);
    const entry: Selected = {
      component,
      module: isMain ? id : `${id}#${component.name}`,
      main: isMain,
      exported,
      child,
    };
    if (isMain) {
      selected.unshift(entry);
    } else {
      selected.push(entry);
    }
  }
  return { selected, diagnostics };
}

/** Parses the file once more and lists the import bindings by local name. */
export function readImports(
  file: string,
  source: string,
): Map<string, { source: string; imported: string }> {
  const imports = new Map<string, { source: string; imported: string }>();
  const program = parseSync(file, source, { lang: 'tsx' }).program;
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      let imported = '*';
      if (specifier.type === 'ImportDefaultSpecifier') {
        imported = 'default';
      } else if (specifier.type === 'ImportSpecifier') {
        imported =
          specifier.imported.type === 'Literal'
            ? specifier.imported.value
            : specifier.imported.name;
      }
      imports.set(specifier.local.name, { source: statement.source.value, imported });
    }
  }
  return imports;
}
