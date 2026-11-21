// Turns slices of a TypeScript source into plain JavaScript text: types are cut out, props
// reads become payload variables, and `return` statements of the entry handler return the model.
import type { Node as AstNode } from '@oxc-project/types';

/** A text replacement over a range of the source. */
interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Maps a name that reads props to the path segments it starts at. */
export type PropsRoots = ReadonlyMap<string, readonly string[]>;

/** What `emitRange` rewrites besides types. */
export interface EmitOptions {
  /** The names that read props. */
  props?: PropsRoots;
  /** Receives the path of each props read, so the caller can add it to the payload. */
  onProps?: (path: string) => void;
  /** The text a top-level `return` of the entry handler becomes, such as `return model;`. */
  returns?: string;
  /** Names declared around the emitted nodes, such as the entry handler's parameters. */
  locals?: readonly string[];
  /** Called with the offset of a `return` inside a `try` block that has a `finally`. */
  onFinallyReturn?: (start: number) => void;
}

/** Returns the payload variable of a props path: `props.user.name` is `props$user$name`. */
export function getPropsVariable(path: string): string {
  return `props$${path.replaceAll('.', '$')}`;
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

/** Lists the child nodes of a node, in field order. */
export function listChildren(node: AstNode): AstNode[] {
  const out: AstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'range') {
      continue;
    }
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) {
          out.push(item);
        }
      }
    } else if (isAstNode(value)) {
      out.push(value);
    }
  }
  return out;
}

const TYPE_FIELDS = ['typeAnnotation', 'returnType', 'typeArguments', 'typeParameters'];
const SCOPE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
]);
const TS_EXPRESSIONS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/** Tells whether a node exists only for types. */
function isTypeNode(node: AstNode): boolean {
  return node.type.startsWith('TS') && !TS_EXPRESSIONS.has(node.type);
}

function isTypeField(parent: AstNode, child: AstNode): boolean {
  for (const key of TYPE_FIELDS) {
    if (Reflect.get(parent, key) === child) {
      return true;
    }
  }
  return false;
}

/** Reads a static member chain `a.b.c`: the root name and the field names. */
function readChain(node: AstNode): { root: string; names: string[] } | undefined {
  const names: string[] = [];
  let current: AstNode = node;
  while (current.type === 'MemberExpression' && !current.computed) {
    names.unshift(current.property.name);
    current = current.object;
  }
  if (current.type !== 'Identifier') {
    return undefined;
  }
  return { root: current.name, names };
}

interface Walk {
  options: EmitOptions;
  edits: Edit[];
  protectedRanges: [number, number][];
  /** The names declared by the enclosing functions, blocks and loops, innermost last. */
  scopes: Set<string>[];
  /** How many enclosing `try` statements with a `finally` hold the node in their block. */
  tryDepth: number;
}

function isShadowed(scopes: readonly Set<string>[], name: string): boolean {
  for (const names of scopes) {
    if (names.has(name)) {
      return true;
    }
  }
  return false;
}

/** Collects the edits for one node and everything under it. */
function collectEdits(node: AstNode, walk: Walk, nested: boolean): void {
  const names = declareScope(node);
  if (names !== undefined) {
    walk.scopes.push(names);
  }
  if (node.type === 'TryStatement' && node.finalizer !== null && !nested) {
    // Only the block and the handler return before the `finally` runs.
    const outer = walk.tryDepth;
    walk.tryDepth = outer + 1;
    collectEdits(node.block, walk, nested);
    if (node.handler !== null) {
      collectEdits(node.handler, walk, nested);
    }
    walk.tryDepth = outer;
    collectEdits(node.finalizer, walk, nested);
  } else {
    visitNode(node, walk, nested);
  }
  if (names !== undefined) {
    walk.scopes.pop();
  }
}

function visitNode(node: AstNode, walk: Walk, nested: boolean): void {
  const { options, edits } = walk;
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      // Keep the expression, cut what follows it.
      edits.push({ start: node.expression.end, end: node.end, text: '' });
      collectEdits(node.expression, walk, nested);
      return;
    case 'TSTypeAssertion':
      edits.push({ start: node.start, end: node.expression.start, text: '' });
      collectEdits(node.expression, walk, nested);
      return;
    case 'CallExpression':
      if (node.callee.type === 'MemberExpression' && !node.callee.computed) {
        // `props.list.map(f)` reads `props.list`, not a field named `map`.
        collectEdits(node.callee.object, walk, nested);
        const typeArguments: unknown = Reflect.get(node, 'typeArguments');
        if (isAstNode(typeArguments)) {
          edits.push({ start: typeArguments.start, end: typeArguments.end, text: '' });
        }
        for (const argument of node.arguments) {
          collectEdits(argument, walk, nested);
        }
        return;
      }
      break;
    case 'TemplateLiteral':
      walk.protectedRanges.push([node.start, node.end]);
      break;
    case 'ReturnStatement':
      if (!nested && options.returns !== undefined) {
        if (walk.tryDepth > 0) {
          options.onFinallyReturn?.(node.start);
        }
        // The returned value is still computed, then the handler returns the model.
        if (node.argument === null) {
          edits.push({ start: node.start, end: node.end, text: options.returns });
        } else {
          const value = node.argument;
          edits.push({ start: node.start, end: value.start, text: '{ ' });
          collectEdits(value, walk, nested);
          edits.push({ start: value.end, end: node.end, text: `; ${options.returns} }` });
        }
        return;
      }
      break;
    case 'Property': {
      // `{ start }` where `start` reads props: `{ start: props$start }`.
      const value = node.value;
      if (node.shorthand && value.type === 'Identifier') {
        const base = options.props?.get(value.name);
        if (base !== undefined && !isShadowed(walk.scopes, value.name)) {
          const path = base.join('.');
          options.onProps?.(path);
          edits.push({
            start: node.start,
            end: node.end,
            text: `${value.name}: ${getPropsVariable(path)}`,
          });
          return;
        }
      }
      break;
    }
    case 'Identifier':
    case 'MemberExpression': {
      const chain = options.props === undefined ? undefined : readChain(node);
      const base = chain === undefined ? undefined : options.props?.get(chain.root);
      if (chain !== undefined && base !== undefined && !isShadowed(walk.scopes, chain.root)) {
        const path = [...base, ...chain.names].join('.');
        options.onProps?.(path);
        edits.push({ start: node.start, end: node.end, text: getPropsVariable(path) });
        return;
      }
      break;
    }
    default:
      break;
  }
  const optional: unknown = Reflect.get(node, 'optional');
  if (optional === true && node.type === 'Identifier') {
    // `b?: T`: the identifier's range includes the `?`.
    const at = node.start + node.name.length;
    edits.push({ start: at, end: at + 1, text: '' });
  }
  for (const key of TYPE_FIELDS) {
    const field: unknown = Reflect.get(node, key);
    if (isAstNode(field)) {
      edits.push({ start: field.start, end: field.end, text: '' });
    }
  }
  const inner = nested || SCOPE_TYPES.has(node.type);
  for (const child of listChildren(node)) {
    if (isTypeField(node, child)) {
      continue;
    }
    if (isTypeNode(child)) {
      // A declaration or an `implements` clause: types only.
      edits.push({ start: child.start, end: child.end, text: '' });
      continue;
    }
    if (node.type === 'MemberExpression' && !node.computed && child === node.property) {
      continue;
    }
    if (node.type === 'Property' && !node.computed && child === node.key) {
      continue;
    }
    collectEdits(child, walk, inner);
  }
}

/** Removes `indent` spaces from each line after the first, and adds `prefix` to every line. */
function reindent(
  text: string,
  from: number,
  indent: number,
  prefix: string,
  protectedRanges: [number, number][],
): string {
  const out: string[] = [];
  let offset = from;
  for (const [index, line] of text.split('\n').entries()) {
    const lineStart = offset;
    offset += line.length + 1;
    let inside = false;
    for (const [start, end] of protectedRanges) {
      if (index > 0 && lineStart > start && lineStart < end) {
        inside = true;
      }
    }
    if (inside) {
      out.push(line);
      continue;
    }
    let cut = 0;
    if (index > 0) {
      while (cut < indent && line[cut] === ' ') {
        cut++;
      }
    }
    const rest = line.slice(cut);
    out.push(rest === '' ? '' : prefix + rest);
  }
  return out.join('\n');
}

/**
 * Emits the source between two offsets as plain JavaScript. The nodes are the ones that lie in
 * the range. Lines after the first lose the indentation of the first line, and every line gets
 * `prefix`. Offsets in edits refer to the original source, so the text is not shifted between
 * edits.
 */
export function emitRange(
  source: string,
  nodes: readonly AstNode[],
  from: number,
  to: number,
  options: EmitOptions,
  prefix: string,
): string {
  const base = new Set<string>(options.locals);
  for (const name of listBlockNames(nodes)) {
    base.add(name);
  }
  const walk: Walk = { options, edits: [], protectedRanges: [], scopes: [base], tryDepth: 0 };
  for (const node of nodes) {
    if (isTypeNode(node)) {
      walk.edits.push({ start: node.start, end: node.end, text: '' });
    } else {
      collectEdits(node, walk, false);
    }
  }
  walk.edits.sort((a, b) => a.start - b.start || b.end - a.end);
  let text = '';
  let cursor = from;
  const applied: Edit[] = [];
  for (const edit of walk.edits) {
    if (edit.start < cursor) {
      // Inside a range an earlier edit already replaced.
      continue;
    }
    text += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
    applied.push(edit);
  }
  text += source.slice(cursor, to);
  // Edits move text, so the protected ranges move with it.
  const moved: [number, number][] = [];
  for (const [start, end] of walk.protectedRanges) {
    let shift = 0;
    for (const edit of applied) {
      if (edit.end <= start) {
        shift += edit.text.length - (edit.end - edit.start);
      }
    }
    moved.push([start + shift, end + shift]);
  }
  const lineStart = source.lastIndexOf('\n', from - 1) + 1;
  return reindent(text, from, from - lineStart, prefix, moved);
}

/** Lists the names a binding pattern declares. */
export function listPatternNames(pattern: AstNode, into: string[]): void {
  switch (pattern.type) {
    case 'Identifier':
      into.push(pattern.name);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        listPatternNames(
          property.type === 'RestElement' ? property.argument : property.value,
          into,
        );
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element !== null) {
          listPatternNames(element, into);
        }
      }
      break;
    case 'AssignmentPattern':
      listPatternNames(pattern.left, into);
      break;
    case 'RestElement':
      listPatternNames(pattern.argument, into);
      break;
    default:
      break;
  }
}

/** Lists the names the statements of a block declare. */
function listBlockNames(statements: readonly AstNode[]): string[] {
  const names: string[] = [];
  for (const statement of statements) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        listPatternNames(declarator.id, names);
      }
    } else if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
      statement.id !== null
    ) {
      names.push(statement.id.name);
    }
  }
  return names;
}

/** Returns the names a node introduces for what is inside it, if any. */
function declareScope(node: AstNode): Set<string> | undefined {
  const names: string[] = [];
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      for (const param of node.params) {
        listPatternNames(param, names);
      }
      if (node.type === 'FunctionExpression' && node.id !== null) {
        names.push(node.id.name);
      }
      break;
    case 'BlockStatement':
    case 'StaticBlock':
      names.push(...listBlockNames(node.body));
      break;
    case 'ForStatement':
      names.push(...listBlockNames(node.init === null ? [] : [node.init]));
      break;
    case 'ForInStatement':
    case 'ForOfStatement':
      names.push(...listBlockNames([node.left]));
      break;
    case 'CatchClause':
      if (node.param !== null) {
        listPatternNames(node.param, names);
      }
      break;
    default:
      return undefined;
  }
  return new Set(names);
}

/** A name a piece of code refers to, in source order. */
export interface Reference {
  name: string;
  start: number;
  /** True for the target of an assignment or an update. */
  write: boolean;
}

function scanNode(node: AstNode, scopes: Set<string>[], out: Reference[]): void {
  if (isTypeNode(node)) {
    return;
  }
  const names = declareScope(node);
  if (names !== undefined) {
    scopes.push(names);
  }
  if (node.type === 'Identifier') {
    if (!isShadowed(scopes, node.name)) {
      out.push({ name: node.name, start: node.start, write: false });
    }
  } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
    const target = node.left;
    const free = !isShadowed(scopes, target.name);
    if (free && node.operator !== '=') {
      out.push({ name: target.name, start: target.start, write: false });
    }
    scanNode(node.right, scopes, out);
    if (free) {
      out.push({ name: target.name, start: target.start, write: true });
    }
  } else if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') {
    const target = node.argument;
    if (!isShadowed(scopes, target.name)) {
      out.push({ name: target.name, start: target.start, write: false });
      out.push({ name: target.name, start: target.start, write: true });
    }
  } else {
    for (const child of listChildren(node)) {
      if (isTypeField(node, child)) {
        continue;
      }
      if (node.type === 'MemberExpression' && !node.computed && child === node.property) {
        continue;
      }
      if (node.type === 'Property' && !node.computed && child === node.key && !node.shorthand) {
        continue;
      }
      scanNode(child, scopes, out);
    }
  }
  if (names !== undefined) {
    scopes.pop();
  }
}

/**
 * Lists the names a node refers to, in source order, without the names declared inside it and
 * without type positions. `locals` are names declared around the node.
 */
export function scanReferences(node: AstNode, locals: readonly string[] = []): Reference[] {
  const out: Reference[] = [];
  scanNode(node, [new Set(locals)], out);
  return out;
}

/** Adds every name an expression or declaration refers to. */
export function listReferences(
  node: AstNode,
  into: Set<string>,
  locals: readonly string[] = [],
): void {
  for (const reference of scanReferences(node, locals)) {
    into.add(reference.name);
  }
}
