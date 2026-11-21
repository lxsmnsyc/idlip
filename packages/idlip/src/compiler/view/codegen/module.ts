// Finds the module-level helpers and imports a generated module needs and prints them as JS.
import { parseSync } from 'oxc-parser';
import type { Node as AstNode, Program } from '@oxc-project/types';
import { quote } from './text.ts';

interface Declaration {
  name: string;
  node: AstNode;
  /** Every identifier the declaration mentions. */
  mentions: Set<string>;
}

interface ImportBinding {
  source: string;
  /** `default`, `*` or the imported name. */
  imported: string;
  local: string;
}

interface Edit {
  start: number;
  end: number;
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

/** Keys whose node is a type, and is removed when the code is printed as JS. */
const TYPE_KEYS = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments']);

function getNodeRange(node: AstNode): Edit {
  return { start: node.start, end: node.end };
}

/** Lists the child nodes of an AST node. */
function getChildren(node: AstNode): [string, AstNode][] {
  const children: [string, AstNode][] = [];
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      for (const item of value as unknown[]) {
        if (isAstNode(item)) {
          children.push([key, item]);
        }
      }
    } else if (isAstNode(value)) {
      children.push([key, value]);
    }
  }
  return children;
}

export interface CollectedModule {
  imports: string[];
  code: string[];
}

/** The module-level declarations and imports of a source file. */
export class ModuleSource {
  declarations: Map<string, Declaration> = new Map();
  imports: Map<string, ImportBinding> = new Map();

  constructor(
    file: string,
    readonly source: string,
  ) {
    const program: Program = parseSync(file, source, { lang: 'tsx' }).program;
    for (const statement of program.body) {
      this.read(statement);
    }
  }

  /** Every name the module declares or imports. */
  getNames(): Set<string> {
    return new Set([...this.declarations.keys(), ...this.imports.keys()]);
  }

  read(statement: AstNode): void {
    if (statement.type === 'ImportDeclaration') {
      if (statement.importKind === 'type') {
        return;
      }
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportSpecifier') {
          if (specifier.importKind === 'type') {
            continue;
          }
          const imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          this.imports.set(specifier.local.name, {
            source: statement.source.value,
            imported,
            local: specifier.local.name,
          });
        } else {
          this.imports.set(specifier.local.name, {
            source: statement.source.value,
            imported: specifier.type === 'ImportDefaultSpecifier' ? 'default' : '*',
            local: specifier.local.name,
          });
        }
      }
      return;
    }
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
      this.read(statement.declaration);
      return;
    }
    if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
      if (statement.id !== null) {
        this.add(statement.id.name, statement);
      }
      return;
    }
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === 'Identifier') {
          this.add(declarator.id.name, statement);
        }
      }
    }
  }

  add(name: string, node: AstNode): void {
    const mentions = new Set<string>();
    const stack: AstNode[] = [node];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) {
        break;
      }
      if (current.type === 'Identifier') {
        mentions.add(current.name);
      }
      for (const [, child] of getChildren(current)) {
        stack.push(child);
      }
    }
    this.declarations.set(name, { name, node, mentions });
  }

  /**
   * Returns the imports and the declarations (as JS, in source order) that the named helpers and
   * imports need, including what the helpers mention.
   */
  collect(
    modules: Iterable<string>,
    imports: Iterable<string>,
  ): { imports: string[]; code: string[] } {
    const wantedModules = new Set<string>();
    const wantedImports = new Set<string>(imports);
    const queue: string[] = [...modules];
    // Follow what each helper mentions.
    while (queue.length > 0) {
      const name = queue.pop();
      if (name === undefined || wantedModules.has(name)) {
        continue;
      }
      const declaration = this.declarations.get(name);
      if (declaration === undefined) {
        continue;
      }
      wantedModules.add(name);
      for (const mention of declaration.mentions) {
        if (this.declarations.has(mention)) {
          queue.push(mention);
        } else if (this.imports.has(mention)) {
          wantedImports.add(mention);
        }
      }
    }
    // Print declarations in source order, once each.
    const code: string[] = [];
    const printed = new Set<AstNode>();
    for (const declaration of this.declarations.values()) {
      if (wantedModules.has(declaration.name) && !printed.has(declaration.node)) {
        printed.add(declaration.node);
        code.push(this.print(declaration.node));
      }
    }
    return { imports: this.printImports(wantedImports), code };
  }

  printImports(wanted: Set<string>): string[] {
    const bySource = new Map<
      string,
      { default: string | undefined; named: string[]; namespaces: string[] }
    >();
    for (const [local, binding] of this.imports) {
      if (!wanted.has(local)) {
        continue;
      }
      let entry = bySource.get(binding.source);
      if (entry === undefined) {
        entry = { default: undefined, named: [], namespaces: [] };
        bySource.set(binding.source, entry);
      }
      if (binding.imported === 'default') {
        entry.default = local;
      } else if (binding.imported === '*') {
        entry.namespaces.push(local);
      } else {
        entry.named.push(binding.imported === local ? local : `${binding.imported} as ${local}`);
      }
    }
    const lines: string[] = [];
    for (const [source, entry] of bySource) {
      for (const namespace of entry.namespaces) {
        lines.push(`import * as ${namespace} from ${quote(source)};`);
      }
      const clauses: string[] = [];
      if (entry.default !== undefined) {
        clauses.push(entry.default);
      }
      if (entry.named.length > 0) {
        clauses.push(`{ ${entry.named.join(', ')} }`);
      }
      if (clauses.length > 0) {
        lines.push(`import ${clauses.join(', ')} from ${quote(source)};`);
      }
    }
    return lines;
  }

  /** Prints a node's source with its type syntax removed. */
  print(node: AstNode): string {
    const edits: Edit[] = [];
    this.findTypeEdits(node, edits);
    // Edits are found outermost first in source order within each subtree; apply from the end.
    const ordered = [...edits];
    for (let index = 1; index < ordered.length; index++) {
      let at = index;
      while (at > 0 && ordered[at - 1].start < ordered[at].start) {
        [ordered[at - 1], ordered[at]] = [ordered[at], ordered[at - 1]];
        at--;
      }
    }
    let out = this.source.slice(node.start, node.end);
    for (const edit of ordered) {
      out = out.slice(0, edit.start - node.start) + out.slice(edit.end - node.start);
    }
    return out;
  }

  findTypeEdits(node: AstNode, edits: Edit[]): void {
    for (const [key, child] of getChildren(node)) {
      if (TYPE_KEYS.has(key)) {
        const range = getNodeRange(child);
        // `x?: T` loses its `?` too.
        const before = this.source.lastIndexOf('?', range.start);
        if (
          Reflect.get(node, 'optional') === true &&
          before >= node.start &&
          this.source.slice(before + 1, range.start).trim() === ''
        ) {
          range.start = before;
        }
        edits.push(range);
        continue;
      }
      if (
        (child.type === 'TSAsExpression' ||
          child.type === 'TSSatisfiesExpression' ||
          child.type === 'TSNonNullExpression') &&
        key !== 'typeAnnotation'
      ) {
        // `x as T` and `x!` keep `x`.
        edits.push({ start: child.expression.end, end: child.end });
        this.findTypeEdits(child.expression, edits);
        continue;
      }
      this.findTypeEdits(child, edits);
    }
  }
}
