// Reads the function components of a `*.idlip.tsx` file with oxc-parser into the view IR:
// state fields, derived values, handlers, the view tree, the path set per hole and diagnostics.
import { parseSync } from 'oxc-parser';
import type {
  ArrowFunctionExpression,
  Node as AstNode,
  CallExpression,
  Expression,
  Function as FunctionNode,
  JSXAttribute,
  JSXAttributeValue,
  JSXChild,
  JSXElement,
  JSXExpression,
  JSXFragment,
  JSXIdentifier,
  JSXMemberExpression,
  ModuleExportName,
  Program,
  PropertyKey,
  ReturnStatement,
  VariableDeclaration,
  VariableDeclarator,
} from '@oxc-project/types';
import type {
  Attr,
  BinaryOp,
  Component,
  Diagnostic,
  Event,
  EventModifier,
  Expr,
  FreeKind,
  Handler,
  HandlerPart,
  Hole,
  Method,
  ModuleIR,
  Namespace,
  Node,
  Path,
  Ref,
  Root,
  Segment,
  Severity,
  Slot,
  Span,
  Target,
  UnaryOp,
} from './ir.ts';
import { findImpliedWrapper, findNestingProblem } from './nesting.ts';
import { locate, printPath } from './print.ts';

/** Any identifier node: a reference, a binding or a name. */
type IdentifierNode = Extract<AstNode, { type: 'Identifier' }>;

/** The expression of an attribute: its container's expression, or the value itself. */
type AttrExpression = JSXAttributeValue | JSXExpression;

/** A function declaration, function expression or arrow function. */
type FunctionLike = FunctionNode | ArrowFunctionExpression;

const BLOCKS = new Set(['For', 'Try', 'Head', 'Subscribe']);

const GLOBALS = new Set([
  'Array',
  'Boolean',
  'Date',
  'Error',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Set',
  'String',
  'Symbol',
  'URL',
  'URLSearchParams',
  'console',
  'crypto',
  'performance',
  'structuredClone',
  'undefined',
  'NaN',
  'Infinity',
  'globalThis',
  'window',
  'document',
]);

const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]);

const IMPURE: Record<string, ReadonlySet<string>> = {
  Math: new Set(['random']),
  Date: new Set(['now']),
  performance: new Set(['now']),
  crypto: new Set(['randomUUID', 'getRandomValues']),
};

/** Impure globals callable in a hole, marked `impure: true` (view-ir v8). */
const HOLE_IMPURE: Record<string, ReadonlySet<string> | undefined> = {
  Math: new Set(['random']),
  Date: new Set(['now']),
  performance: new Set(['now']),
  crypto: new Set(['randomUUID']),
};

/** Pure globals callable in a hole. `Math.*` except `Math.random` is handled apart. */
const PURE_GLOBALS = new Set(['String', 'Number', 'Boolean']);

/** Non-mutating methods that take no function argument, callable on any value in a hole. */
const METHODS: ReadonlySet<string> = new Set<Method>([
  'trim',
  'toUpperCase',
  'toLowerCase',
  'slice',
  'includes',
  'startsWith',
  'endsWith',
  'indexOf',
  'join',
  'at',
  'padStart',
  'padEnd',
  'toFixed',
]);

const UNARY: ReadonlySet<string> = new Set<UnaryOp>(['!', '-', '+', 'typeof']);
const BINARY: ReadonlySet<string> = new Set<BinaryOp>([
  '===',
  '!==',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
]);

function isUnaryOp(op: string): op is UnaryOp {
  return UNARY.has(op);
}

function isBinaryOp(op: string): op is BinaryOp {
  return BINARY.has(op);
}

function isMethod(name: string): name is Method {
  return METHODS.has(name);
}

// ---------------------------------------------------------------------------------------------
// Scopes

interface ModuleScope {
  /** `imported` is the exported name, `default` for a default import, `*` for a namespace. */
  imports: Map<string, { source: string; imported: string; typeOnly: boolean }>;
  consts: Map<string, Expression | null>;
  functions: Map<string, FunctionNode>;
  components: Map<string, FunctionNode>;
}

/** What a name in a hole or event resolves to. */
type Binding =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'state'; name: string }
  | { kind: 'derived'; name: string; node: Expression }
  | { kind: 'handler'; name: string }
  | { kind: 'props'; stateless: boolean }
  | {
      kind: 'props-subst';
      values: Map<string, Expr>;
      messages: Map<string, Event>;
      children: Node[];
    }
  | { kind: 'message'; event: Event }
  | { kind: 'nodes'; nodes: Node[] }
  | { kind: 'reset' }
  | { kind: 'hidden'; rule: string; why: string };

interface Scope {
  parent: Scope | undefined;
  names: Map<string, Binding>;
  /** Derived values lowered so far, per scope that declares them. */
  derivedCache: Map<string, Expr>;
  derivedBusy: Set<string>;
}

function createScope(parent: Scope | undefined): Scope {
  return { parent, names: new Map(), derivedCache: new Map(), derivedBusy: new Set() };
}

function lookupBinding(scope: Scope, name: string): { binding: Binding; owner: Scope } | undefined {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    const binding = current.names.get(name);
    if (binding !== undefined) {
      return { binding, owner: current };
    }
  }
  return undefined;
}

/** Loop roots map to the list they iterate, so item reads resolve to `list.*.field`. */
interface LoopInfo {
  base: Path | undefined;
  fallback: Path[];
}

/** The source of a module that `AnalyzeOptions.readImport` found. */
export interface ImportedModule {
  /** The resolved file name, used in diagnostics. */
  file: string;
  source: string;
}

export interface AnalyzeOptions {
  /**
   * Reads the module an import specifier names, relative to the importing file. The analysis
   * calls it for components imported from `.idlip.tsx` files, to tell a stateless component,
   * which it inlines, from a stateful one, which becomes a child block. Without it, or when it
   * returns `undefined`, an imported component is a child block.
   */
  readImport?: (specifier: string, importer: string) => ImportedModule | undefined;
}

/** A parsed imported module. */
interface ForeignModule {
  file: string;
  source: string;
  module: ModuleScope;
  /** Exported names to their declarations, `default` included. */
  exports: Map<string, FunctionNode>;
}

/** Set while the body of an imported stateless component is inlined. */
interface ForeignContext {
  file: string;
  source: string;
  /** The `<Tag>` in the analyzed file; spans inside the imported body map to it. */
  use: Span;
}

/** Thrown to abandon inlining a helper whose body leaves the closed grammar. */
class InlineAbort extends Error {}

// ---------------------------------------------------------------------------------------------
// Analyzer

class Analyzer {
  source: string;
  readonly file: string;
  module: ModuleScope;
  readonly options: AnalyzeOptions;
  readonly foreignModules = new Map<string, ForeignModule | undefined>();
  foreign: ForeignContext | undefined;
  /** Where the expression being lowered sits. Impure globals are allowed in holes only. */
  position: 'hole' | 'event' | 'init' = 'hole';
  readonly diagnostics: Diagnostic[] = [];
  readonly loops = new WeakMap<Root, LoopInfo>();
  /** Diagnostics go here while trying to inline a helper. */
  sink: Diagnostic[] | undefined;
  holes: Hole[] = [];
  childPosition = 0;
  inlineStack: string[] = [];

  constructor(file: string, source: string, program: Program, options: AnalyzeOptions) {
    this.file = file;
    this.source = source;
    this.module = readModule(program);
    this.options = options;
  }

  /** A span in the analyzed file. Inside an imported component's body, the span of its use. */
  readSpan(node: { start: number; end: number }): Span {
    if (this.foreign !== undefined) {
      return { ...this.foreign.use };
    }
    return { start: node.start, end: node.end };
  }

  report(
    rule: string,
    severity: Severity,
    message: string,
    node: { start: number; end: number },
  ): void {
    if (this.sink !== undefined) {
      if (severity === 'error') {
        throw new InlineAbort(rule);
      }
      return;
    }
    // Inside an imported component, the message names the place in that file.
    const text =
      this.foreign === undefined
        ? message
        : `${this.foreign.file}:${locate(this.foreign.source, node.start)}: ${message}`;
    this.diagnostics.push({ rule, severity, message: text, span: this.readSpan(node) });
  }

  reportError(rule: string, message: string, node: AstNode): Expr {
    this.report(rule, 'error', message, node);
    return { kind: 'literal', value: undefined };
  }

  readText(node: { start: number; end: number }): string {
    return this.source.slice(node.start, node.end);
  }

  // -------------------------------------------------------------------------------------------
  // Closed grammar

  lower(node: AstNode, scope: Scope): Expr {
    switch (node.type) {
      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
      case 'TSTypeAssertion':
      case 'ChainExpression':
        return this.lower(node.expression, scope);
      case 'Literal':
        if ('regex' in node || 'bigint' in node) {
          return this.reportError(
            'hole-literal',
            'Regular expression and bigint literals are not in the closed grammar',
            node,
          );
        }
        return { kind: 'literal', value: node.value };
      case 'TemplateLiteral': {
        const quasis: string[] = [];
        for (const quasi of node.quasis) {
          quasis.push(quasi.value.cooked ?? quasi.value.raw);
        }
        const exprs: Expr[] = [];
        for (const expression of node.expressions) {
          exprs.push(this.lower(expression, scope));
        }
        return { kind: 'template', quasis, exprs };
      }
      case 'Identifier':
      case 'MemberExpression':
        return this.lowerReference(node, scope);
      case 'UnaryExpression':
        if (!isUnaryOp(node.operator)) {
          return this.reportError(
            'hole-operator',
            `The operator ${node.operator} is not in the closed grammar`,
            node,
          );
        }
        return { kind: 'unary', op: node.operator, arg: this.lower(node.argument, scope) };
      case 'BinaryExpression':
        if (!isBinaryOp(node.operator)) {
          return this.reportError(
            'hole-operator',
            `The operator ${node.operator} is not in the closed grammar`,
            node,
          );
        }
        return {
          kind: 'binary',
          op: node.operator,
          left: this.lower(node.left, scope),
          right: this.lower(node.right, scope),
        };
      case 'LogicalExpression':
        return {
          kind: 'logical',
          op: node.operator,
          left: this.lower(node.left, scope),
          right: this.lower(node.right, scope),
        };
      case 'ConditionalExpression':
        return {
          kind: 'conditional',
          test: this.lower(node.test, scope),
          then: this.lower(node.consequent, scope),
          else: this.lower(node.alternate, scope),
        };
      case 'ObjectExpression': {
        const entries: { key: string; value: Expr }[] = [];
        for (const property of node.properties) {
          if (
            property.type !== 'Property' ||
            property.computed ||
            property.method ||
            property.kind !== 'init'
          ) {
            this.reportError(
              'hole-object',
              'Object literals in holes take plain keys and values: no spread, methods or computed keys',
              property,
            );
            continue;
          }
          const key = readKeyName(property.key);
          entries.push({ key, value: this.lower(property.value, scope) });
        }
        return { kind: 'object', entries };
      }
      case 'ArrayExpression': {
        const items: Expr[] = [];
        for (const element of node.elements) {
          if (element === null || element.type === 'SpreadElement') {
            this.reportError(
              'hole-array',
              'Array literals in holes take no holes or spread',
              element ?? node,
            );
            continue;
          }
          items.push(this.lower(element, scope));
        }
        return { kind: 'array', items };
      }
      case 'CallExpression':
        return this.lowerCall(node, scope);
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        return this.reportError('hole-closure', 'A closure is not allowed in a hole', node);
      case 'JSXElement':
      case 'JSXFragment':
        return this.reportError(
          'hole-jsx',
          'JSX is allowed only as a view child or a condition branch',
          node,
        );
      case 'AssignmentExpression':
      case 'UpdateExpression':
      case 'SequenceExpression':
        return this.reportError('hole-statement', 'Assignments are not allowed in a hole', node);
      case 'AwaitExpression':
      case 'YieldExpression':
      case 'NewExpression':
      case 'TaggedTemplateExpression':
        return this.reportError('hole-effect', `${node.type} is not in the closed grammar`, node);
      default:
        return this.reportError('hole-grammar', `${node.type} is not in the closed grammar`, node);
    }
  }

  /** Lowers an identifier or a member chain to a path, or to a substituted expression. */
  lowerReference(node: AstNode, scope: Scope): Expr {
    // Walk down to the root identifier, collecting segments.
    const segments: Segment[] = [];
    let optional = false;
    let current = node;
    while (
      current.type === 'MemberExpression' ||
      current.type === 'ChainExpression' ||
      current.type === 'TSNonNullExpression'
    ) {
      if (current.type !== 'MemberExpression') {
        current = current.expression;
        continue;
      }
      if (current.optional) {
        optional = true;
      }
      if (!current.computed) {
        segments.unshift(current.property.name);
      } else if (
        current.property.type === 'Literal' &&
        typeof current.property.value !== 'object'
      ) {
        segments.unshift(String(current.property.value));
      } else {
        segments.unshift({ kind: 'index', value: this.lower(current.property, scope) });
      }
      current = current.object;
    }
    if (current.type !== 'Identifier') {
      const base = this.lower(current, scope);
      return this.extendPath(base, segments, optional, node);
    }
    const name: string = current.name;
    if (name === 'undefined') {
      return { kind: 'literal', value: undefined };
    }
    if (name === 'NaN') {
      return { kind: 'literal', value: Number.NaN };
    }
    if (name === 'Infinity') {
      return { kind: 'literal', value: Number.POSITIVE_INFINITY };
    }
    const found = lookupBinding(scope, name);
    if (found === undefined) {
      const root = this.resolveModule(name, current);
      if (root !== undefined) {
        if (root.kind === 'module' && this.module.functions.has(name)) {
          return this.reportError(
            'hole-function-value',
            `The function ${name} is used as a value; call it or move it to a handler`,
            current,
          );
        }
        if (root.kind === 'module' && this.module.components.has(name)) {
          return this.reportError(
            'hole-function-value',
            `The component ${name} is used as a value`,
            current,
          );
        }
        return { kind: 'path', root, segments, optional };
      }
      if (GLOBALS.has(name)) {
        return this.reportError(
          'hole-global',
          `The global ${name} is not in the closed grammar; wrap it in a helper`,
          current,
        );
      }
      return this.reportError(
        'hole-unknown',
        `${name} is not a state field, derived value, prop, loop variable, import or module-level binding`,
        current,
      );
    }
    const { binding, owner } = found;
    switch (binding.kind) {
      case 'expr':
        return this.extendPath(binding.expr, segments, optional, node);
      case 'state':
        return { kind: 'path', root: { kind: 'state', name }, segments, optional };
      case 'props':
        return { kind: 'path', root: { kind: 'props' }, segments, optional };
      case 'derived':
        return this.extendPath(
          this.lowerDerived(binding.name, binding.node, owner),
          segments,
          optional,
          node,
        );
      case 'props-subst': {
        const [first, ...rest] = segments;
        if (typeof first !== 'string') {
          return this.reportError(
            'props-whole',
            'A stateless component must read props by name, not pass the props object along',
            current,
          );
        }
        const value = binding.values.get(first);
        if (value === undefined) {
          if (binding.messages.has(first) || first === 'children') {
            return this.reportError(
              'hole-message',
              `props.${first} is allowed only in an event prop or as a view child`,
              node,
            );
          }
          return { kind: 'literal', value: undefined };
        }
        return this.extendPath(value, rest, optional, node);
      }
      case 'handler':
        return this.reportError(
          'hole-handler',
          `The handler ${name} is allowed only in an event prop`,
          current,
        );
      case 'message':
      case 'reset':
        return this.reportError(
          'hole-message',
          `${name} is allowed only in an event prop`,
          current,
        );
      case 'nodes':
        return this.reportError(
          'hole-children',
          `${name} is allowed only as a view child`,
          current,
        );
      default:
        // `hidden`: a name the current scope must not read.
        return this.reportError(binding.rule, binding.why, current);
    }
  }

  /** Adds segments to an expression that is a path; anything else leaves the grammar. */
  extendPath(base: Expr, segments: Segment[], optional: boolean, node: AstNode): Expr {
    if (segments.length === 0) {
      return base;
    }
    if (base.kind === 'path') {
      return {
        kind: 'path',
        root: base.root,
        segments: [...base.segments, ...segments],
        optional: base.optional || optional,
      };
    }
    if (base.kind === 'literal' && base.value === undefined) {
      return base;
    }
    // `.length` is allowed on any value, like the allowed methods.
    if (segments.length === 1 && segments[0] === 'length') {
      return { kind: 'property', receiver: base, name: 'length' };
    }
    if (this.sink !== undefined) {
      throw new InlineAbort('member');
    }
    return this.reportError(
      'hole-member',
      'Property access is allowed only on a path, not on a computed value',
      node,
    );
  }

  lowerDerived(name: string, node: Expression, owner: Scope): Expr {
    const cached = owner.derivedCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    if (owner.derivedBusy.has(name)) {
      return this.reportError('derived-cycle', `The derived value ${name} reads itself`, node);
    }
    owner.derivedBusy.add(name);
    let expr: Expr;
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
      expr = this.reportError(
        'derived-jsx',
        `The derived value ${name} holds JSX; write a stateless component instead`,
        node,
      );
    } else {
      expr = this.lower(node, owner);
    }
    owner.derivedBusy.delete(name);
    owner.derivedCache.set(name, expr);
    return expr;
  }

  resolveModule(name: string, node?: AstNode): Root | undefined {
    const imported = this.module.imports.get(name);
    if (imported !== undefined) {
      if (node !== undefined) {
        this.checkForeignBinding(name, node);
      }
      return { kind: 'import', name, source: imported.source };
    }
    if (
      this.module.consts.has(name) ||
      this.module.functions.has(name) ||
      this.module.components.has(name)
    ) {
      if (node !== undefined) {
        this.checkForeignBinding(name, node);
      }
      return { kind: 'module', name };
    }
    return undefined;
  }

  /**
   * The body of an imported stateless component is inlined into this file, where its own
   * imports and module-level bindings do not exist. It may read its props, pure globals and
   * blocks from `idlip` only.
   */
  checkForeignBinding(name: string, node: AstNode): void {
    if (this.foreign === undefined) {
      return;
    }
    if (this.module.imports.get(name)?.source === 'idlip') {
      return;
    }
    this.report(
      'component-import',
      'error',
      `The imported stateless component reads ${name}, a module-level binding of its own file; pass it as a prop or make the component stateful`,
      node,
    );
  }

  lowerCall(node: CallExpression, scope: Scope): Expr {
    let callee = node.callee;
    while (callee.type === 'ParenthesizedExpression' || callee.type === 'TSNonNullExpression') {
      callee = callee.expression;
    }
    // Find the callee's root.
    let root: Root | undefined;
    let helperNode: FunctionLike | undefined;
    if (callee.type === 'Identifier') {
      const found = lookupBinding(scope, callee.name);
      if (found !== undefined) {
        const kind = found.binding.kind;
        if (kind === 'handler') {
          return this.reportError(
            'hole-handler',
            `The handler ${callee.name} cannot be called in a hole`,
            node,
          );
        }
        return this.reportError(
          'hole-call',
          `${callee.name} is not a helper: a helper is an import or a module-level function`,
          node,
        );
      }
      root = this.resolveModule(callee.name, node);
      if (root === undefined && PURE_GLOBALS.has(callee.name)) {
        return {
          kind: 'call',
          callee: { kind: 'global', name: callee.name },
          args: this.lowerArgs(node, scope),
          helper: 'args',
        };
      }
      if (root === undefined) {
        if (GLOBALS.has(callee.name)) {
          return this.reportError(
            'hole-global',
            `The global ${callee.name} is not in the closed grammar; wrap it in a helper`,
            node,
          );
        }
        return this.reportError('hole-unknown', `${callee.name} is not defined`, node);
      }
      if (root.kind === 'module') {
        helperNode = this.module.functions.get(callee.name);
        if (helperNode === undefined) {
          const constant = this.module.consts.get(callee.name);
          if (
            constant?.type === 'ArrowFunctionExpression' ||
            constant?.type === 'FunctionExpression'
          ) {
            helperNode = constant;
          }
        }
        if (helperNode === undefined) {
          return this.reportError('hole-call', `${callee.name} is not a function`, node);
        }
      }
    } else if (callee.type === 'MemberExpression' && !callee.computed) {
      // `api.format(x)`: a namespace import. `draft.trim()`: a method on a path.
      let object = callee.object;
      const names: string[] = [callee.property.name];
      while (object.type === 'MemberExpression' && !object.computed) {
        names.unshift(object.property.name);
        object = object.object;
      }
      if (object.type === 'Identifier' && lookupBinding(scope, object.name) === undefined) {
        const imported = this.module.imports.get(object.name);
        if (imported !== undefined) {
          this.checkForeignBinding(object.name, node);
          root = {
            kind: 'import',
            name: [object.name, ...names].join('.'),
            source: imported.source,
          };
        } else if (names.length === 1 && HOLE_IMPURE[object.name]?.has(names[0]) === true) {
          // An event payload or an initial value would fix the impure value at render.
          if (this.position === 'event') {
            return this.reportError(
              'hole-global',
              `${object.name}.${names[0]}() in an event argument is fixed at render; call it in the handler through await Random or await Time`,
              node,
            );
          }
          if (this.position === 'init') {
            return this.reportError(
              'let-init',
              `${object.name}.${names[0]}() in an initial value differs between server and client; set the field in a handler`,
              node,
            );
          }
          // An impure global reads no paths; `createHole` warns when the hole patches.
          return {
            kind: 'call',
            callee: { kind: 'global', name: `${object.name}.${names[0]}` },
            args: this.lowerArgs(node, scope),
            helper: 'args',
            impure: true,
          };
        } else if (object.name === 'Math' && names.length === 1) {
          return {
            kind: 'call',
            callee: { kind: 'global', name: `Math.${names[0]}` },
            args: this.lowerArgs(node, scope),
            helper: 'args',
          };
        } else if (GLOBALS.has(object.name) && !METHODS.has(callee.property.name)) {
          return this.reportError(
            'hole-global',
            `${object.name}.${names.join('.')} is not in the closed grammar; wrap it in a helper`,
            node,
          );
        }
      }
      if (root === undefined && isMethod(callee.property.name)) {
        return {
          kind: 'method',
          receiver: this.lower(callee.object, scope),
          name: callee.property.name,
          args: this.lowerArgs(node, scope),
        };
      }
      if (root === undefined) {
        return this.reportError(
          'hole-method',
          `The method call ${this.readText(callee)}() is not in the closed grammar; use a helper or <For>`,
          node,
        );
      }
    } else {
      return this.reportError('hole-call', 'The callee of a helper call must be a name', node);
    }
    const args = this.lowerArgs(node, scope);
    // Inline a helper whose body is one return expression in the closed grammar.
    if (helperNode !== undefined) {
      const body = this.tryInline(helperNode, args, root);
      if (body !== undefined) {
        return { kind: 'call', callee: root, args, helper: 'inlined', body };
      }
    }
    return { kind: 'call', callee: root, args, helper: 'args' };
  }

  lowerArgs(node: CallExpression, scope: Scope): Expr[] {
    const args: Expr[] = [];
    for (const argument of node.arguments) {
      if (argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression') {
        this.reportError(
          'helper-closure',
          'A closure argument to a helper is not allowed',
          argument,
        );
        continue;
      }
      if (argument.type === 'SpreadElement') {
        this.reportError('hole-spread', 'Spread arguments are not in the closed grammar', argument);
        continue;
      }
      args.push(this.lower(argument, scope));
    }
    return args;
  }

  tryInline(fn: FunctionLike, args: Expr[], root: Root): Expr | undefined {
    const returned = findReturnedExpression(fn);
    if (returned === undefined) {
      return undefined;
    }
    const name = root.kind === 'module' ? root.name : '';
    if (this.inlineStack.includes(name) || this.inlineStack.length > 8) {
      return undefined;
    }
    const scope = createScope(undefined);
    for (const [index, param] of fn.params.entries()) {
      if (param.type !== 'Identifier') {
        return undefined;
      }
      scope.names.set(param.name, {
        kind: 'expr',
        expr: args[index] ?? { kind: 'literal', value: undefined },
      });
    }
    const saved = this.sink;
    this.sink = [];
    this.inlineStack.push(name);
    try {
      return this.lower(returned, scope);
    } catch (error) {
      if (error instanceof InlineAbort) {
        return undefined;
      }
      throw error;
    } finally {
      this.sink = saved;
      this.inlineStack.pop();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Paths

  findPaths(expr: Expr): Path[] {
    const found: Path[] = [];
    this.collectPaths(expr, found);
    return minimizePaths(found);
  }

  collectPaths(expr: Expr, out: Path[]): void {
    switch (expr.kind) {
      case 'literal':
        return;
      case 'path': {
        const segments: Segment[] = [];
        for (const segment of expr.segments) {
          if (typeof segment === 'object' && segment.kind === 'index') {
            this.collectPaths(segment.value, out);
            segments.push({ kind: 'item' });
          } else {
            segments.push(segment);
          }
        }
        const root = expr.root;
        if (root.kind === 'state') {
          out.push({ root: 'state', segments: [root.name, ...segments] });
        } else if (root.kind === 'props') {
          out.push({ root: 'props', segments });
        } else if (root.kind === 'loop') {
          const info = this.loops.get(root);
          if (info?.base !== undefined) {
            out.push({ root: info.base.root, segments: [...info.base.segments, ...segments] });
          } else if (info !== undefined) {
            for (const path of info.fallback) {
              out.push(path);
            }
          }
        }
        return;
      }
      case 'unary':
        this.collectPaths(expr.arg, out);
        return;
      case 'binary':
      case 'logical':
        this.collectPaths(expr.left, out);
        this.collectPaths(expr.right, out);
        return;
      case 'conditional':
        this.collectPaths(expr.test, out);
        this.collectPaths(expr.then, out);
        this.collectPaths(expr.else, out);
        return;
      case 'template':
        for (const item of expr.exprs) {
          this.collectPaths(item, out);
        }
        return;
      case 'object':
        for (const entry of expr.entries) {
          this.collectPaths(entry.value, out);
        }
        return;
      case 'array':
        for (const item of expr.items) {
          this.collectPaths(item, out);
        }
        return;
      case 'property':
        this.collectPaths(expr.receiver, out);
        return;
      case 'method':
        this.collectPaths(expr.receiver, out);
        for (const item of expr.args) {
          this.collectPaths(item, out);
        }
        return;
      case 'call':
        if (expr.helper === 'inlined') {
          this.collectPaths(expr.body, out);
        } else {
          for (const item of expr.args) {
            this.collectPaths(item, out);
          }
        }
    }
  }

  createHole(node: AstNode, scope: Scope): Hole {
    const expr = this.lower(node, scope);
    const hole: Hole = {
      id: this.holes.length,
      expr,
      paths: this.findPaths(expr),
      span: this.readSpan(node),
    };
    // The analysis never produces `dynamic` for the closed grammar. Until `dynamic-paths`
    // lands, one would be an error.
    if (hole.paths === 'dynamic') {
      this.report('hole-dynamic', 'error', 'This hole needs runtime path tracking', node);
    } else if (hole.paths.length > 0 && hasImpureCall(expr)) {
      // An impure value recomputes only when the hole's paths change.
      const names: string[] = [];
      for (const path of hole.paths) {
        names.push(printPath(path));
      }
      this.report(
        'hole-impure',
        'warning',
        `This hole calls an impure global, so its value changes only when ${names.join(', ')} changes`,
        node,
      );
    }
    this.holes.push(hole);
    return hole;
  }

  // -------------------------------------------------------------------------------------------
  // Events

  /** Lowers an event prop. Its arguments are computed at render into the payload. */
  lowerEvent(
    name: string,
    mode: 'on' | 'latest',
    value: JSXAttributeValue | JSXAttribute,
    scope: Scope,
    passValue = false,
  ): Event | undefined {
    const saved = this.position;
    this.position = 'event';
    try {
      return this.lowerEventValue(name, mode, value, scope, passValue);
    } finally {
      this.position = saved;
    }
  }

  lowerEventValue(
    name: string,
    mode: 'on' | 'latest',
    value: JSXAttributeValue | JSXAttribute,
    scope: Scope,
    passValue: boolean,
  ): Event | undefined {
    const span: Span = this.readSpan(value);
    let expression = value.type === 'JSXExpressionContainer' ? value.expression : value;
    while (expression.type === 'ParenthesizedExpression') {
      expression = expression.expression;
    }
    // `on:click={add}` or `on:click={props.onRemove}`.
    if (expression.type === 'Identifier' || expression.type === 'MemberExpression') {
      const target = this.resolveTarget(expression, scope);
      if (target === undefined) {
        return undefined;
      }
      if ('event' in target) {
        return { ...target.event, name, mode, span };
      }
      // A subscription value is the payload of a bare handler reference.
      const args: Expr[] = passValue
        ? [{ kind: 'path', root: { kind: 'event' }, segments: [], optional: false }]
        : [];
      return { name, mode, target, args, paths: [], modifiers: [], span };
    }
    if (expression.type !== 'ArrowFunctionExpression' || expression.async) {
      this.reportError(
        'event-closure',
        'An event prop takes a handler, or an arrow whose body is one handler call',
        expression,
      );
      return undefined;
    }
    const param = expression.params.length === 1 ? expression.params[0] : undefined;
    if (expression.params.length > 1 || (param !== undefined && param.type !== 'Identifier')) {
      this.reportError(
        'event-param',
        'An event arrow takes at most one parameter, the event, as a plain name',
        expression,
      );
      return undefined;
    }
    const parsed = this.readEventBody(expression, param?.name);
    if (parsed === undefined) {
      return undefined;
    }
    const { body, modifiers } = parsed;
    const target = this.resolveTarget(body.callee, scope);
    if (target === undefined) {
      return undefined;
    }
    const inner = createScope(scope);
    if (param?.type === 'Identifier') {
      inner.names.set(param.name, {
        kind: 'expr',
        expr: { kind: 'path', root: { kind: 'event' }, segments: [], optional: false },
      });
    }
    if ('event' in target) {
      if (body.arguments.length > 0) {
        this.reportError(
          'event-message-args',
          'A forwarded message prop already carries its arguments',
          body,
        );
      }
      return { ...target.event, name, mode, span };
    }
    const args: Expr[] = [];
    for (const argument of body.arguments) {
      if (argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression') {
        this.reportError(
          'event-closure',
          'A closure is not allowed as a handler argument',
          argument,
        );
        continue;
      }
      if (param !== undefined && readsEventOutsidePath(argument, param.name)) {
        this.reportError(
          'event-placeholder',
          `An argument reads ${param.name} only as a whole path such as ${param.name}.currentTarget.value`,
          argument,
        );
        continue;
      }
      args.push(this.lower(argument, inner));
    }
    const paths: Path[] = [];
    for (const argument of args) {
      this.collectPaths(argument, paths);
    }
    this.checkPassivePrevent(modifiers, expression);
    return { name, mode, target, args, paths: minimizePaths(paths), modifiers, span };
  }

  /**
   * Reads the body of an event arrow: one handler call, optionally behind leading
   * `e.preventDefault();` and `e.stopPropagation();` statements, or behind one `if` with a key test.
   */
  readEventBody(
    arrow: ArrowFunctionExpression,
    param: string | undefined,
  ): { body: CallExpression; modifiers: EventModifier[] } | undefined {
    const fail = (node: AstNode): void => {
      this.reportError(
        'event-closure',
        'The body of an event arrow must be one handler call, optionally behind e.preventDefault(), e.stopPropagation() or an if on e.key',
        node,
      );
    };
    if (arrow.body.type !== 'BlockStatement') {
      if (arrow.body.type === 'CallExpression') {
        return { body: arrow.body, modifiers: [] };
      }
      fail(arrow.body);
      return undefined;
    }
    const statements = arrow.body.body;
    const modifiers: EventModifier[] = [];
    let index = 0;
    while (index < statements.length) {
      const modifier = readEventModifier(statements[index], param);
      if (modifier === undefined) {
        break;
      }
      // A repeated modifier stays in the remaining statements and fails below.
      if (!addModifier(modifiers, modifier)) {
        break;
      }
      index++;
    }
    if (statements.length - index !== 1) {
      fail(arrow.body);
      return undefined;
    }
    const last = statements[index];
    if (last.type === 'ExpressionStatement') {
      if (last.expression.type === 'CallExpression') {
        return { body: last.expression, modifiers };
      }
      fail(last.expression);
      return undefined;
    }
    // `if (<test>) <call>` carries the key filter. Modifier statements before it do not mix.
    if (
      last.type !== 'IfStatement' ||
      index > 0 ||
      last.alternate !== null ||
      param === undefined
    ) {
      fail(last);
      return undefined;
    }
    const filter = readKeyFilter(last.test, param);
    if (filter === undefined) {
      fail(last.test);
      return undefined;
    }
    modifiers.push({ kind: 'key', filter });
    let inner = last.consequent;
    const consequent = inner.type === 'BlockStatement' ? inner.body : [inner];
    let position = 0;
    while (position < consequent.length) {
      const modifier = readEventModifier(consequent[position], param);
      if (modifier === undefined) {
        break;
      }
      if (!addModifier(modifiers, modifier)) {
        break;
      }
      position++;
    }
    inner = consequent[position];
    if (
      consequent.length - position !== 1 ||
      inner.type !== 'ExpressionStatement' ||
      inner.expression.type !== 'CallExpression'
    ) {
      fail(last.consequent);
      return undefined;
    }
    return { body: inner.expression, modifiers };
  }

  /** `passive` promises the handler never calls `preventDefault`. No source form gives `passive` yet. */
  checkPassivePrevent(modifiers: EventModifier[], node: AstNode): void {
    let passive = false;
    let prevent = false;
    for (const modifier of modifiers) {
      passive ||= modifier.kind === 'passive';
      prevent ||= modifier.kind === 'prevent';
    }
    if (passive && prevent) {
      this.reportError(
        'event-passive-prevent',
        'An event cannot be both passive and prevent',
        node,
      );
    }
  }

  resolveTarget(node: AstNode, scope: Scope): Target | { event: Event } | undefined {
    if (node.type === 'Identifier') {
      const found = lookupBinding(scope, node.name);
      if (found?.binding.kind === 'handler') {
        return { kind: 'handler', name: node.name };
      }
      if (found?.binding.kind === 'reset') {
        return { kind: 'reset' };
      }
      if (found?.binding.kind === 'message') {
        return { event: found.binding.event };
      }
    }
    if (node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier') {
      const found = lookupBinding(scope, node.object.name);
      if (found?.binding.kind === 'props') {
        return { kind: 'prop', name: node.property.name };
      }
      if (found?.binding.kind === 'props-subst') {
        const event = found.binding.messages.get(node.property.name);
        if (event !== undefined) {
          return { event };
        }
      }
    }
    this.reportError(
      'event-target',
      `${this.readText(node)} is not a handler, a message prop or reset`,
      node,
    );
    return undefined;
  }

  // -------------------------------------------------------------------------------------------
  // View

  lowerChildren(children: JSXChild[], scope: Scope, context: ViewContext): Node[] {
    const out: Node[] = [];
    for (const child of children) {
      if (child.type === 'JSXText') {
        const value = normalizeJsxText(child.value);
        if (value !== '') {
          this.checkTableText(context, child);
          out.push({ kind: 'text', value });
        }
        continue;
      }
      if (child.type === 'JSXExpressionContainer') {
        if (child.expression.type === 'JSXEmptyExpression') {
          continue;
        }
        for (const node of this.lowerBranch(child.expression, scope, context)) {
          out.push(node);
        }
        continue;
      }
      if (child.type === 'JSXSpreadChild') {
        this.reportError('jsx-spread', 'Spread children are not allowed', child);
        continue;
      }
      for (const node of this.lowerJsx(child, scope, context)) {
        out.push(node);
      }
    }
    return out;
  }

  /** Lowers a view position: JSX, a condition block, children, or a text hole. */
  lowerBranch(node: Expression, scope: Scope, context: ViewContext): Node[] {
    while (node.type === 'ParenthesizedExpression') {
      node = node.expression;
    }
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
      return this.lowerJsx(node, scope, context);
    }
    if (
      node.type === 'Literal' &&
      (node.value === null || node.value === false || node.value === '')
    ) {
      return [];
    }
    if (node.type === 'Identifier' && node.name === 'undefined') {
      return [];
    }
    if (
      node.type === 'ConditionalExpression' &&
      (isJsxish(node.consequent) || isJsxish(node.alternate))
    ) {
      return [
        {
          kind: 'condition',
          test: this.createHole(node.test, scope),
          then: this.lowerBranch(node.consequent, scope, context),
          else: this.lowerBranch(node.alternate, scope, context),
          namespace: context.namespace,
        },
      ];
    }
    if (node.type === 'LogicalExpression' && isJsxish(node.right)) {
      if (node.operator !== '&&') {
        this.reportError(
          'condition-operator',
          `A JSX branch after ${node.operator} is not a condition block; write a ternary`,
          node,
        );
        return [];
      }
      return [
        {
          kind: 'condition',
          test: this.createHole(node.left, scope),
          then: this.lowerBranch(node.right, scope, context),
          else: [],
          namespace: context.namespace,
        },
      ];
    }
    // `{children}` or `{props.children}` in a stateless component.
    const nodes = this.resolveChildren(node, scope);
    if (nodes !== undefined) {
      return nodes;
    }
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property.name === 'map'
    ) {
      this.reportError('view-map', 'Lists are written with <For each key>, not .map()', node);
      return [];
    }
    this.checkTableText(context, node);
    return [{ kind: 'text-hole', hole: this.createHole(node, scope) }];
  }

  resolveChildren(node: Expression, scope: Scope): Node[] | undefined {
    if (node.type === 'Identifier') {
      const found = lookupBinding(scope, node.name);
      if (found?.binding.kind === 'nodes') {
        return found.binding.nodes;
      }
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property.name === 'children' &&
      node.object.type === 'Identifier'
    ) {
      const found = lookupBinding(scope, node.object.name);
      if (found?.binding.kind === 'props-subst') {
        return found.binding.children;
      }
      if (found?.binding.kind === 'props') {
        // Analyzed on its own, a stateless component's children are an empty slot.
        if (found.binding.stateless) {
          return [];
        }
        this.reportError(
          'child-children',
          'A stateful component cannot render children passed by its parent yet',
          node,
        );
        return [];
      }
    }
    return undefined;
  }

  checkTableText(context: ViewContext, node: AstNode): void {
    const parent = context.open.at(-1);
    if (
      parent !== undefined &&
      ['table', 'tbody', 'thead', 'tfoot', 'tr'].includes(parent) &&
      context.namespace === 'html'
    ) {
      this.report(
        'html-nesting',
        'error',
        `Text cannot be inside <${parent}>: the HTML parser moves it before the table`,
        node,
      );
    }
  }

  lowerJsx(node: JSXElement | JSXFragment, scope: Scope, context: ViewContext): Node[] {
    if (node.type === 'JSXFragment') {
      return this.lowerChildren(node.children, scope, context);
    }
    const opening = node.openingElement;
    const nameNode = opening.name;
    if (nameNode.type === 'JSXMemberExpression') {
      const root = resolveMemberRoot(nameNode, this.module);
      this.checkImportedComponent(root, nameNode);
      return [this.lowerChild(node, root, scope, context)];
    }
    if (nameNode.type === 'JSXNamespacedName') {
      this.reportError('jsx-namespace-tag', 'Namespaced tags are not supported', nameNode);
      return [];
    }
    const tag: string = nameNode.name;
    if (BLOCKS.has(tag) && this.module.imports.get(tag)?.source === 'idlip') {
      return this.lowerBlock(tag, node, scope, context);
    }
    if (/^[A-Z]/.test(tag)) {
      const local = this.module.components.get(tag);
      if (local !== undefined && isStateless(local)) {
        return this.inlineComponent(tag, local, node, scope, context, undefined);
      }
      const imported = this.findImportedComponent(tag, nameNode);
      if (imported !== undefined && isStateless(imported.fn)) {
        return this.inlineComponent(tag, imported.fn, node, scope, context, imported.module);
      }
      const root = this.resolveModule(tag);
      if (root === undefined) {
        this.reportError(
          'component-unknown',
          `<${tag}> is not an imported or module-level component`,
          nameNode,
        );
        return [];
      }
      this.checkImportedComponent(root, nameNode);
      return [this.lowerChild(node, root, scope, context)];
    }
    if (tag === 'window' || tag === 'document') {
      return [this.lowerGlobal(tag, node, scope)];
    }
    return [this.lowerElement(tag, node, scope, context)];
  }

  /**
   * Reads the declaration of a component imported from an `.idlip.tsx` file through
   * `options.readImport`. Returns `undefined` when there is no reader or it cannot read the file.
   */
  findImportedComponent(
    tag: string,
    node: AstNode,
  ): { fn: FunctionNode; module: ForeignModule } | undefined {
    const imported = this.module.imports.get(tag);
    const read = this.options.readImport;
    if (imported === undefined || read === undefined) {
      return undefined;
    }
    if (imported.imported === '*' || !/\.idlip(\.tsx)?$/.test(imported.source)) {
      return undefined;
    }
    const importer = this.foreign?.file ?? this.file;
    const key = `${importer}\0${imported.source}`;
    let foreign = this.foreignModules.get(key);
    if (!this.foreignModules.has(key)) {
      foreign = readForeignModule(read(imported.source, importer));
      this.foreignModules.set(key, foreign);
    }
    if (foreign === undefined) {
      return undefined;
    }
    const fn = foreign.exports.get(imported.imported);
    if (fn === undefined) {
      this.report(
        'component-import',
        'error',
        `${foreign.file} has no component export named ${imported.imported}`,
        node,
      );
      return undefined;
    }
    return { fn, module: foreign };
  }

  /** An imported component must come from an `.idlip.tsx` file. */
  checkImportedComponent(root: Root, node: AstNode): void {
    if (root.kind !== 'import') {
      return;
    }
    if (!/\.idlip(\.tsx)?$/.test(root.source)) {
      this.report(
        'component-import',
        'error',
        `${root.name} comes from ${root.source}, which is not an .idlip.tsx component`,
        node,
      );
    }
  }

  lowerElement(tag: string, node: JSXElement, scope: Scope, context: ViewContext): Node {
    let namespace = context.namespace;
    if (tag === 'svg') {
      namespace = 'svg';
    } else if (tag === 'math') {
      namespace = 'mathml';
    }
    if (namespace === 'html') {
      const problem = findNestingProblem(context.open, tag);
      if (problem !== undefined) {
        this.report(
          'html-nesting',
          'error',
          `<${tag}> cannot be inside <${problem}>: the HTML parser closes or moves it before the page runs`,
          node.openingElement,
        );
      }
      const implied = findImpliedWrapper(context.open.at(-1), tag);
      if (implied !== undefined) {
        this.report(
          'html-implied',
          'error',
          `<${tag}> directly inside <${context.open.at(-1)}> makes the HTML parser insert ${implied}; write it out`,
          node.openingElement,
        );
      }
    }
    if (tag === 'title' && !context.inHead && namespace !== 'svg') {
      this.report('title-outside-head', 'error', '<title> belongs in <Head>', node.openingElement);
    }
    const attrs: Attr[] = [];
    const events: Event[] = [];
    let ref: Ref | undefined;
    let html: Hole | undefined;
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.reportError('jsx-spread', 'Spread attributes are not allowed', attribute);
        continue;
      }
      const name = attribute.name;
      if (
        name.type === 'JSXNamespacedName' &&
        (name.namespace.name === 'on' || name.namespace.name === 'latest')
      ) {
        const event = this.lowerEvent(
          name.name.name,
          name.namespace.name,
          attribute.value ?? attribute,
          scope,
        );
        if (event === undefined) {
          continue;
        }
        for (const other of events) {
          if (other.name === event.name) {
            this.reportError(
              'event-mode-twice',
              `${event.name} has both on: and latest:, or appears twice`,
              attribute,
            );
          }
        }
        events.push(event);
        continue;
      }
      const attrName =
        name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name;
      const value = attribute.value;
      if (attrName.startsWith('i-')) {
        this.reportError(
          'attr-reserved',
          `${attrName} starts with i-, which the compiled format reserves`,
          attribute,
        );
        continue;
      }
      if (attrName === 'ref') {
        ref = this.lowerRef(value, scope, context, attribute);
        continue;
      }
      if (attrName === 'html') {
        html = this.lowerHtml(value, scope, attribute);
        continue;
      }
      if (value === null) {
        attrs.push({ name: attrName, value: { kind: 'static', value: true } });
      } else if (value.type === 'Literal') {
        attrs.push({ name: attrName, value: { kind: 'static', value: value.value } });
      } else if (value.type === 'JSXExpressionContainer') {
        if (value.expression.type === 'Literal' && typeof value.expression.value === 'string') {
          attrs.push({ name: attrName, value: { kind: 'static', value: value.expression.value } });
        } else {
          attrs.push({
            name: attrName,
            value: { kind: 'hole', hole: this.createHole(value.expression, scope) },
          });
        }
      } else {
        this.reportError('attr-jsx', 'An attribute value cannot be JSX', value);
      }
    }
    const inner: ViewContext = {
      ...context,
      namespace: tag === 'foreignObject' ? 'html' : namespace,
      open: [...context.open, tag],
    };
    const children = this.lowerChildren(node.children, scope, inner);
    if (namespace === 'html') {
      this.checkRawText(tag, children, node.openingElement);
    }
    if (html !== undefined && children.length > 0) {
      this.report(
        'html-children',
        'error',
        'An element with html={trusted(...)} must have no children',
        node.openingElement,
      );
    }
    return {
      kind: 'element',
      tag,
      namespace,
      attrs,
      events,
      ref,
      html,
      children,
      span: this.readSpan(node),
    };
  }

  /** A hole cannot sit in a raw text element, or share a `<textarea>` or `<title>` with other content. */
  checkRawText(tag: string, children: Node[], node: AstNode): void {
    const raw = tag === 'script' || tag === 'style';
    if (!raw && tag !== 'textarea' && tag !== 'title') {
      return;
    }
    if (!hasTextHole(children) || (!raw && children.length === 1)) {
      return;
    }
    this.reportError(
      'html-raw-text',
      raw ? `A hole cannot be inside <${tag}>` : `A hole inside <${tag}> must be its only content`,
      node,
    );
  }

  lowerRef(
    value: JSXAttributeValue | null,
    scope: Scope,
    context: ViewContext,
    attribute: JSXAttribute,
  ): Ref | undefined {
    if (value?.type === 'Literal' && typeof value.value === 'string') {
      return { kind: 'name', name: value.value };
    }
    const expression = value?.type === 'JSXExpressionContainer' ? value.expression : undefined;
    if (expression?.type === 'Literal' && typeof expression.value === 'string') {
      return { kind: 'name', name: expression.value };
    }
    if (
      expression?.type === 'ArrayExpression' &&
      expression.elements.length === 2 &&
      context.loopDepth > 0
    ) {
      const [first, second] = expression.elements;
      if (
        first?.type === 'Literal' &&
        typeof first.value === 'string' &&
        second !== null &&
        second.type !== 'SpreadElement'
      ) {
        const key = this.lower(second, scope);
        if (key.kind === 'path' && key.root.kind === 'loop') {
          return { kind: 'tuple', name: first.value, key };
        }
      }
    }
    this.report(
      'ref-form',
      'error',
      'ref takes a string literal, or [literal, loop variable path] inside <For>',
      attribute,
    );
    return undefined;
  }

  lowerHtml(
    value: JSXAttributeValue | null,
    scope: Scope,
    attribute: JSXAttribute,
  ): Hole | undefined {
    const expression = value?.type === 'JSXExpressionContainer' ? value.expression : undefined;
    if (
      expression?.type === 'CallExpression' &&
      expression.callee.type === 'Identifier' &&
      expression.callee.name === 'trusted' &&
      this.module.imports.get('trusted')?.source === 'idlip' &&
      expression.arguments.length === 1
    ) {
      return this.createHole(expression.arguments[0], scope);
    }
    this.report('html-trusted', 'error', 'html takes trusted(value) from idlip', attribute);
    return undefined;
  }

  lowerGlobal(tag: 'window' | 'document', node: JSXElement, scope: Scope): Node {
    const events: Event[] = [];
    for (const attribute of node.openingElement.attributes) {
      const name = attribute.type === 'JSXAttribute' ? attribute.name : undefined;
      if (
        attribute.type === 'JSXAttribute' &&
        name?.type === 'JSXNamespacedName' &&
        (name.namespace.name === 'on' || name.namespace.name === 'latest')
      ) {
        const event = this.lowerEvent(
          name.name.name,
          name.namespace.name,
          attribute.value ?? attribute,
          scope,
        );
        if (event !== undefined) {
          events.push(event);
        }
      } else {
        this.reportError('global-attr', `<${tag}> takes event props only`, attribute);
      }
    }
    if (node.children.length > 0) {
      this.reportError('global-children', `<${tag}> takes no children`, node);
    }
    return { kind: 'global', target: tag, events };
  }

  lowerBlock(tag: string, node: JSXElement, scope: Scope, context: ViewContext): Node[] {
    const attrs = new Map<string, JSXAttribute>();
    const events: Event[] = [];
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.reportError('jsx-spread', 'Spread attributes are not allowed', attribute);
        continue;
      }
      const name = attribute.name;
      if (
        name.type === 'JSXNamespacedName' &&
        (name.namespace.name === 'on' || name.namespace.name === 'latest')
      ) {
        const event = this.lowerEvent(
          name.name.name,
          name.namespace.name,
          attribute.value ?? attribute,
          scope,
          tag === 'Subscribe',
        );
        if (event !== undefined) {
          events.push(event);
        }
        continue;
      }
      attrs.set(
        name.type === 'JSXNamespacedName' ? `${name.namespace.name}:${name.name.name}` : name.name,
        attribute,
      );
    }
    const readAttrExpression = (name: string): AttrExpression | undefined => {
      const value = attrs.get(name)?.value;
      return value?.type === 'JSXExpressionContainer' ? value.expression : (value ?? undefined);
    };
    switch (tag) {
      case 'For':
        return this.lowerFor(node, readAttrExpression, scope, context);
      case 'Try': {
        const handler = readAttrExpression('catch');
        const body = this.lowerChildren(node.children, scope, context);
        const params = handler?.type === 'ArrowFunctionExpression' ? handler.params : [];
        const errorParam = params.at(0);
        const resetParam = params.at(1);
        if (
          handler?.type !== 'ArrowFunctionExpression' ||
          handler.params.length > 2 ||
          handler.body.type === 'BlockStatement' ||
          errorParam?.type !== 'Identifier' ||
          (resetParam !== undefined && resetParam.type !== 'Identifier')
        ) {
          this.reportError(
            'try-catch',
            '<Try> takes catch={(error, reset) => <jsx>}',
            node.openingElement,
          );
          return body;
        }
        const inner = createScope(scope);
        inner.names.set(errorParam.name, {
          kind: 'expr',
          expr: {
            kind: 'path',
            root: { kind: 'local', name: errorParam.name },
            segments: [],
            optional: false,
          },
        });
        if (resetParam !== undefined) {
          inner.names.set(resetParam.name, { kind: 'reset' });
        }
        const catchView = this.lowerBranch(handler.body, inner, context);
        return [
          { kind: 'try', body, error: errorParam.name, reset: resetParam?.name, catch: catchView },
        ];
      }
      case 'Head':
        return [
          {
            kind: 'head',
            children: this.lowerChildren(node.children, scope, {
              ...context,
              open: [],
              inHead: true,
            }),
          },
        ];
      case 'Subscribe': {
        const to = readAttrExpression('to');
        let source: Root | undefined;
        if (to?.type === 'Identifier' && lookupBinding(scope, to.name) === undefined) {
          source = this.resolveModule(to.name, to);
        }
        if (source === undefined) {
          this.reportError(
            'subscribe-source',
            '<Subscribe to> takes an imported or module-level async generator',
            to ?? node.openingElement,
          );
          return [];
        }
        const inputNode = readAttrExpression('input');
        const keyNode = readAttrExpression('key');
        const input = inputNode === undefined ? undefined : this.createHole(inputNode, scope);
        const key = keyNode === undefined ? undefined : this.createHole(keyNode, scope);
        if (input !== undefined && input.paths !== 'dynamic' && input.paths.length > 0) {
          const keyPaths: string[] = [];
          if (key !== undefined && key.paths !== 'dynamic') {
            for (const path of key.paths) {
              keyPaths.push(printPath(path));
            }
          }
          for (const path of input.paths) {
            if (!keyPaths.includes(printPath(path))) {
              this.reportError(
                'subscribe-input-key',
                `<Subscribe input> reads ${printPath(path)}, so key must read it too`,
                inputNode ?? node,
              );
            }
          }
        }
        if (node.children.length > 0) {
          this.reportError('subscribe-children', '<Subscribe> takes no children', node);
        }
        return [{ kind: 'subscribe', source, input, key, events }];
      }
    }
    return [];
  }

  lowerFor(
    node: JSXElement,
    readAttrExpression: (name: string) => AttrExpression | undefined,
    scope: Scope,
    context: ViewContext,
  ): Node[] {
    const eachNode = readAttrExpression('each');
    const keyNode = readAttrExpression('key');
    if (eachNode === undefined) {
      this.reportError('for-each', '<For> needs each', node.openingElement);
      return [];
    }
    if (keyNode?.type !== 'Literal' || typeof keyNode.value !== 'string') {
      this.reportError(
        'for-key',
        '<For> needs key="field", a string literal naming a field of the item',
        node.openingElement,
      );
    }
    const each = this.createHole(eachNode, scope);
    const children = collectNonBlank(node.children);
    const render =
      children.length === 1 && children[0].type === 'JSXExpressionContainer'
        ? children[0].expression
        : undefined;
    if (
      render?.type !== 'ArrowFunctionExpression' ||
      render.params.length === 0 ||
      render.params.length > 2 ||
      render.body.type === 'BlockStatement'
    ) {
      this.reportError(
        'for-render',
        '<For> takes one child: (item, index?) => <jsx>',
        node.openingElement,
      );
      return [];
    }
    // The item root iterates `each`. An exact base exists only when `each` is a path.
    const eachExpr = each.expr;
    const eachPaths = each.paths === 'dynamic' ? [] : each.paths;
    let base: Path | undefined;
    if (eachExpr.kind === 'path' && !hasComputedSegment(eachExpr.segments)) {
      const own: Path[] = [];
      this.collectPaths(eachExpr, own);
      if (own.length === 1) {
        base = own[0];
      }
    }
    const inner = createScope(scope);
    const itemParam = render.params[0];
    const indexParam = render.params.at(1);
    const itemName = itemParam.type === 'Identifier' ? itemParam.name : '$item';
    const itemRoot: Root = { kind: 'loop', name: itemName, index: false };
    this.loops.set(itemRoot, {
      base:
        base === undefined
          ? undefined
          : { root: base.root, segments: [...base.segments, { kind: 'item' }] },
      fallback: eachPaths,
    });
    const itemExpr: Expr = { kind: 'path', root: itemRoot, segments: [], optional: false };
    if (itemParam.type === 'Identifier') {
      inner.names.set(itemName, { kind: 'expr', expr: itemExpr });
    } else if (itemParam.type === 'ObjectPattern') {
      // `({ id, done }) =>` resolves each field to the item path.
      for (const property of itemParam.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.value.type !== 'Identifier'
        ) {
          this.reportError(
            'for-param',
            'A <For> item pattern takes plain fields only, without defaults or rest',
            property,
          );
          continue;
        }
        inner.names.set(property.value.name, {
          kind: 'expr',
          expr: { ...itemExpr, segments: [readKeyName(property.key)] },
        });
      }
    } else {
      this.reportError('for-param', 'The <For> item is a name or an object pattern', itemParam);
    }
    let indexName: string | undefined;
    if (indexParam !== undefined && indexParam.type !== 'Identifier') {
      this.reportError('for-param', 'The <For> index is a plain name', indexParam);
    } else if (indexParam !== undefined) {
      indexName = indexParam.name;
      const indexRoot: Root = { kind: 'loop', name: indexParam.name, index: true };
      // A row's index changes when the list changes, so it reads the list itself.
      this.loops.set(indexRoot, { base, fallback: eachPaths });
      inner.names.set(indexParam.name, {
        kind: 'expr',
        expr: { kind: 'path', root: indexRoot, segments: [], optional: false },
      });
    }
    const body = this.lowerBranch(render.body, inner, {
      ...context,
      loopDepth: context.loopDepth + 1,
    });
    return [
      {
        kind: 'for',
        each,
        key: keyNode?.type === 'Literal' && typeof keyNode.value === 'string' ? keyNode.value : '',
        item: itemName,
        index: indexName,
        namespace: context.namespace,
        body,
      },
    ];
  }

  /** A stateful child component: a child block with its own model slot. */
  lowerChild(node: JSXElement, component: Root, scope: Scope, context: ViewContext): Node {
    const props: { name: string; value: Hole }[] = [];
    const messages: Event[] = [];
    let slot: Slot | undefined;
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.reportError('jsx-spread', 'Spread props are not allowed', attribute);
        continue;
      }
      const name: string =
        attribute.name.type === 'JSXNamespacedName'
          ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
          : attribute.name.name;
      const value = attribute.value;
      const expression =
        value?.type === 'JSXExpressionContainer' ? value.expression : (value ?? undefined);
      if (/^on[A-Z]/.test(name)) {
        const event = this.lowerEvent(name, 'on', value ?? attribute, scope);
        if (event !== undefined) {
          messages.push(event);
        }
        continue;
      }
      if (expression === undefined || expression.type === 'JSXEmptyExpression') {
        // `<Child flag />` passes `true`.
        const hole: Hole = {
          id: this.holes.length,
          expr: { kind: 'literal', value: true },
          paths: [],
          span: this.readSpan(attribute),
        };
        this.holes.push(hole);
        props.push({ name, value: hole });
        continue;
      }
      if (name === 'key') {
        slot = { kind: 'key', hole: this.createHole(expression, scope) };
        continue;
      }
      props.push({ name, value: this.createHole(expression, scope) });
    }
    if (collectNonBlank(node.children).length > 0) {
      this.reportError(
        'child-children',
        'Children of a stateful component are not supported yet',
        node,
      );
    }
    slot ??=
      context.loopDepth > 0
        ? { kind: 'for-key' }
        : { kind: 'position', index: this.childPosition++ };
    return { kind: 'child', component, props, messages, slot };
  }

  /** Inlines a stateless component: its view is lowered with its props bound to the caller's expressions. */
  inlineComponent(
    tag: string,
    fn: FunctionNode,
    node: JSXElement,
    callerScope: Scope,
    context: ViewContext,
    foreign: ForeignModule | undefined,
  ): Node[] {
    if (this.inlineStack.includes(tag)) {
      this.reportError('component-recursive', `<${tag}> renders itself`, node.openingElement);
      return [];
    }
    const values = new Map<string, Expr>();
    const messages = new Map<string, Event>();
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.reportError('jsx-spread', 'Spread props are not allowed', attribute);
        continue;
      }
      const name =
        attribute.name.type === 'JSXNamespacedName'
          ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
          : attribute.name.name;
      const value = attribute.value;
      if (/^on[A-Z]/.test(name)) {
        const event = this.lowerEvent(name, 'on', value ?? attribute, callerScope);
        if (event !== undefined) {
          messages.set(name, event);
        }
        continue;
      }
      if (value === null) {
        values.set(name, { kind: 'literal', value: true });
      } else if (value.type === 'Literal') {
        values.set(name, { kind: 'literal', value: value.value });
      } else if (value.type === 'JSXExpressionContainer') {
        values.set(name, this.lower(value.expression, callerScope));
      } else {
        values.set(name, this.lower(value, callerScope));
      }
    }
    const children = this.lowerChildren(node.children, callerScope, context);
    // The component sees only module bindings and its props.
    const scope = createScope(undefined);
    const param = fn.params.at(0);
    if (param?.type === 'Identifier') {
      scope.names.set(param.name, { kind: 'props-subst', values, messages, children });
    } else if (param?.type === 'ObjectPattern') {
      for (const property of param.properties) {
        if (property.type !== 'Property' || property.value.type !== 'Identifier') {
          continue;
        }
        const key = readKeyName(property.key);
        const local: string = property.value.name;
        const event = messages.get(key);
        if (key === 'children') {
          scope.names.set(local, { kind: 'nodes', nodes: children });
        } else if (event === undefined) {
          scope.names.set(local, {
            kind: 'expr',
            expr: values.get(key) ?? { kind: 'literal', value: undefined },
          });
        } else {
          scope.names.set(local, { kind: 'message', event });
        }
      }
    }
    let returned: Expression | null | undefined;
    for (const statement of fn.body?.body ?? []) {
      if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
        for (const declarator of statement.declarations) {
          if (declarator.id.type === 'Identifier' && declarator.init !== null) {
            scope.names.set(declarator.id.name, {
              kind: 'derived',
              name: declarator.id.name,
              node: declarator.init,
            });
          }
        }
      } else if (statement.type === 'ReturnStatement') {
        returned = statement.argument;
      }
    }
    if (returned === undefined || returned === null) {
      return [];
    }
    // An imported body is lowered against its own module; spans map to this use.
    const saved = { module: this.module, source: this.source, foreign: this.foreign };
    if (foreign !== undefined) {
      this.module = foreign.module;
      this.source = foreign.source;
      this.foreign = {
        file: foreign.file,
        source: foreign.source,
        use: saved.foreign?.use ?? { start: node.start, end: node.end },
      };
    }
    this.inlineStack.push(tag);
    try {
      return this.lowerBranch(returned, scope, context);
    } finally {
      this.inlineStack.pop();
      this.module = saved.module;
      this.source = saved.source;
      this.foreign = saved.foreign;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Components

  analyzeComponent(name: string, fn: FunctionNode, exported: boolean): Component {
    this.holes = [];
    this.childPosition = 0;
    const scope = createScope(undefined);
    // Initial values see props, imports and module constants only.
    const initScope = createScope(undefined);
    let props: Component['props'] = { kind: 'none' };
    if (fn.params.length > 1) {
      this.reportError('props-count', 'A component takes one parameter, props', fn.params[1]);
    }
    const param = fn.params.at(0);
    const stateless = isStateless(fn);
    if (param?.type === 'Identifier') {
      props = { kind: 'param', name: param.name };
      scope.names.set(param.name, { kind: 'props', stateless });
      initScope.names.set(param.name, { kind: 'props', stateless });
    } else if (param?.type === 'ObjectPattern') {
      const fields: { key: string; local: string }[] = [];
      for (const property of param.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.value.type !== 'Identifier'
        ) {
          this.reportError(
            'props-pattern',
            'A props pattern takes plain fields only, without defaults or rest',
            property,
          );
          continue;
        }
        const key = readKeyName(property.key);
        fields.push({ key, local: property.value.name });
        if (stateless && key === 'children') {
          scope.names.set(property.value.name, { kind: 'nodes', nodes: [] });
          continue;
        }
        if (/^on[A-Z]/.test(key)) {
          const event: Event = {
            name: '',
            mode: 'on',
            target: { kind: 'prop', name: key },
            args: [],
            paths: [],
            modifiers: [],
            span: { start: property.start, end: property.end },
          };
          scope.names.set(property.value.name, { kind: 'message', event });
          continue;
        }
        const binding: Binding = {
          kind: 'expr',
          expr: {
            kind: 'path',
            root: { kind: 'props' },
            segments: [key],
            optional: false,
          },
        };
        scope.names.set(property.value.name, binding);
        initScope.names.set(property.value.name, binding);
      }
      props = { kind: 'pattern', fields };
    } else if (param !== undefined) {
      this.reportError(
        'props-pattern',
        'The props parameter is a name or an object pattern',
        param,
      );
    }

    // Read the body: declarations and one return.
    const lets: VariableDeclaration[] = [];
    const consts: VariableDeclaration[] = [];
    const functions: FunctionNode[] = [];
    let returned: ReturnStatement | undefined;
    for (const statement of fn.body?.body ?? []) {
      if (returned !== undefined) {
        this.reportError(
          'body-statement',
          'The return must be the last statement of a component',
          statement,
        );
        continue;
      }
      switch (statement.type) {
        case 'VariableDeclaration':
          if (statement.kind === 'let') {
            lets.push(statement);
          } else if (statement.kind === 'const') {
            consts.push(statement);
          } else {
            this.reportError(
              'body-var',
              'Use let for state and const for derived values, not var',
              statement,
            );
          }
          break;
        case 'FunctionDeclaration':
          functions.push(statement);
          break;
        case 'ReturnStatement':
          returned = statement;
          break;
        case 'TSInterfaceDeclaration':
        case 'TSTypeAliasDeclaration':
          break;
        default:
          this.reportError(
            'body-statement',
            `A component body holds declarations and one return, not ${statement.type}`,
            statement,
          );
      }
    }

    // State fields.
    const stateNodes: { name: string; init: Expression; node: VariableDeclarator }[] = [];
    for (const declaration of lets) {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier') {
          this.reportError(
            'body-destructure',
            'State is declared one name at a time; destructuring is not allowed',
            declarator.id,
          );
          continue;
        }
        const stateName: string = declarator.id.name;
        if (declarator.id.typeAnnotation) {
          this.reportError(
            'let-annotation',
            `Write let ${stateName} = value satisfies T as T, not let ${stateName}: T`,
            declarator.id,
          );
        }
        if (declarator.init === null) {
          this.reportError(
            'let-init',
            `The state field ${stateName} needs an initial value`,
            declarator,
          );
          continue;
        }
        if (
          declarator.init.type === 'TSAsExpression' &&
          declarator.init.expression.type !== 'TSSatisfiesExpression'
        ) {
          this.reportError(
            'let-bare-as',
            `Write value satisfies T as T: a bare as T hides a wrong initial value`,
            declarator.init,
          );
        }
        scope.names.set(stateName, { kind: 'state', name: stateName });
        initScope.names.set(stateName, {
          kind: 'hidden',
          rule: 'init-scope',
          why: 'An initial value reads props, imports and module constants only',
        });
        stateNodes.push({ name: stateName, init: declarator.init, node: declarator });
      }
    }
    // Derived values.
    const derivedNames: string[] = [];
    for (const declaration of consts) {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier') {
          this.reportError(
            'body-destructure',
            'Derived values are declared one name at a time; destructuring is not allowed',
            declarator.id,
          );
          continue;
        }
        scope.names.set(declarator.id.name, {
          kind: 'derived',
          name: declarator.id.name,
          node: declarator.init ?? {
            type: 'Identifier',
            name: 'undefined',
            start: declarator.end,
            end: declarator.end,
          },
        });
        initScope.names.set(declarator.id.name, {
          kind: 'hidden',
          rule: 'init-scope',
          why: 'An initial value reads props, imports and module constants only',
        });
        derivedNames.push(declarator.id.name);
      }
    }
    // Handlers.
    for (const declaration of functions) {
      const handlerName = declaration.id?.name ?? '';
      scope.names.set(handlerName, { kind: 'handler', name: handlerName });
      initScope.names.set(handlerName, {
        kind: 'hidden',
        rule: 'init-scope',
        why: 'An initial value cannot read a handler',
      });
    }

    const state: Component['state'] = [];
    for (const field of stateNodes) {
      this.position = 'init';
      const init = this.lower(field.init, initScope);
      this.position = 'hole';
      state.push({ name: field.name, init, assigned: false });
    }
    const derived: Component['derived'] = [];
    for (const derivedName of derivedNames) {
      const binding = scope.names.get(derivedName);
      if (binding?.kind !== 'derived') {
        continue;
      }
      derived.push({
        name: derivedName,
        expr: this.lowerDerived(derivedName, binding.node, scope),
      });
    }
    const handlers: Handler[] = [];
    for (const declaration of functions) {
      handlers.push(this.analyzeHandler(declaration, scope));
    }

    // A let that no handler assigns is a warning.
    const written = new Set<string>();
    for (const handler of handlers) {
      for (const field of handler.writes) {
        written.add(field);
      }
    }
    for (const [index, field] of state.entries()) {
      field.assigned = written.has(field.name);
      if (!field.assigned) {
        const node = stateNodes[index].node;
        this.report(
          'let-unassigned',
          'warning',
          `The state field ${field.name} is never assigned; make it a const`,
          node,
        );
      }
    }

    let view: Node[] = [];
    if (returned?.argument === null || returned?.argument === undefined) {
      this.reportError('body-return', `The component ${name} must end with return <jsx>`, fn);
    } else {
      view = this.lowerBranch(returned.argument, scope, {
        open: [],
        namespace: 'html',
        inHead: false,
        loopDepth: 0,
      });
    }
    return {
      name,
      exported,
      mode: lets.length === 0 && functions.length === 0 ? 'stateless' : 'stateful',
      props,
      state,
      derived,
      handlers,
      view,
      holes: this.holes,
    };
  }

  // -------------------------------------------------------------------------------------------
  // Handlers

  analyzeHandler(fn: FunctionNode, scope: Scope): Handler {
    const name = fn.id?.name ?? '';
    const free = new Map<string, FreeKind>();
    const propsPaths = new Map<string, Path[]>();
    const chained = new WeakSet<AstNode>();
    const writes = new Set<string>();
    const awaits: { node: AstNode; callee: Root | undefined }[] = [];
    /** Each local reference: name, position, and where its declaration ends. */
    const references: { name: string; at: number; declaredEnd: number }[] = [];
    const params: string[] = [];
    if (fn.generator) {
      this.reportError('handler-generator', `The handler ${name} cannot be a generator`, fn);
    }

    // Each scope maps a local name to the end of its declaration.
    const scopes: Map<string, number>[] = [];
    const paramScope = new Map<string, number>();
    for (const param of fn.params) {
      for (const id of listPatternNames(param)) {
        paramScope.set(id, fn.start);
        params.push(id);
      }
    }
    scopes.push(paramScope);

    const resolveLocal = (id: string): number | undefined => {
      for (let index = scopes.length - 1; index >= 0; index--) {
        const end = scopes[index].get(id);
        if (end !== undefined) {
          return end;
        }
      }
      return undefined;
    };

    /** Records a props path read by the handler: `props.x.y` or a pattern field. */
    const recordProps = (id: { name: string }, names: string[]): void => {
      if (resolveLocal(id.name) !== undefined) {
        return;
      }
      const binding = lookupBinding(scope, id.name)?.binding;
      let base: Segment[] | undefined;
      if (binding?.kind === 'props') {
        base = [];
      } else if (
        binding?.kind === 'expr' &&
        binding.expr.kind === 'path' &&
        binding.expr.root.kind === 'props'
      ) {
        base = binding.expr.segments;
      }
      if (base === undefined) {
        return;
      }
      const list = propsPaths.get(id.name) ?? [];
      list.push({ root: 'props', segments: [...base, ...names] });
      propsPaths.set(id.name, list);
    };

    const classify = (id: string, node: AstNode): void => {
      const found = lookupBinding(scope, id);
      if (found !== undefined) {
        const binding = found.binding;
        let kind: FreeKind;
        if (binding.kind === 'state') {
          kind = 'state';
        } else if (binding.kind === 'derived') {
          kind = 'derived';
        } else if (binding.kind === 'handler') {
          kind = 'handler';
        } else {
          kind = 'props';
        }
        free.set(id, kind);
        return;
      }
      const root = this.resolveModule(id);
      if (root !== undefined) {
        free.set(id, root.kind === 'import' ? 'import' : 'module');
        return;
      }
      if (GLOBALS.has(id)) {
        free.set(id, 'global');
        return;
      }
      this.reportError(
        'handler-free',
        `${id} in ${name} is not state, a derived value, a prop, a handler, an import or a module-level binding`,
        node,
      );
    };

    const declareBlock = (statements: readonly AstNode[], target: Map<string, number>): void => {
      for (const statement of statements) {
        const declaration =
          statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        if (declaration?.type === 'VariableDeclaration') {
          for (const declarator of declaration.declarations) {
            for (const id of listPatternNames(declarator.id)) {
              target.set(id, declarator.end);
            }
          }
        } else if (
          declaration?.type === 'FunctionDeclaration' ||
          declaration?.type === 'ClassDeclaration'
        ) {
          if (declaration.id) {
            target.set(declaration.id.name, declaration.start);
          }
        }
      }
    };

    /** The root identifier of a member chain, if any. */
    const findRootName = (node: AstNode): { name: string } | undefined => {
      let current = node;
      while (
        current.type === 'MemberExpression' ||
        current.type === 'TSNonNullExpression' ||
        current.type === 'ParenthesizedExpression' ||
        current.type === 'ChainExpression'
      ) {
        current = current.type === 'MemberExpression' ? current.object : current.expression;
      }
      return current.type === 'Identifier' ? current : undefined;
    };

    const isState = (id: string): boolean =>
      resolveLocal(id) === undefined && lookupBinding(scope, id)?.binding.kind === 'state';

    // Locals that hold a part of a state value, such as `const t = todos[0]`.
    const aliases = new WeakMap<Map<string, number>, Set<string>>();
    const findScope = (id: string): Map<string, number> | undefined => {
      for (let index = scopes.length - 1; index >= 0; index--) {
        if (scopes[index].has(id)) {
          return scopes[index];
        }
      }
      return undefined;
    };
    /** An alias belongs to the scope that declares it, so a shadowing name is not one. */
    const isAlias = (id: string): boolean => {
      const declaring = findScope(id);
      return declaring !== undefined && aliases.get(declaring)?.has(id) === true;
    };
    const ALIAS_CALLS = new Set(['find', 'findLast', 'at']);

    /** True when the value is a state value, or a member or element of one, reached by a local. */
    const isStateRooted = (node: AstNode): boolean => {
      let current = node;
      for (;;) {
        if (current.type === 'MemberExpression') {
          current = current.object;
        } else if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          !current.callee.computed &&
          ALIAS_CALLS.has(current.callee.property.name)
        ) {
          current = current.callee.object;
        } else if (
          current.type === 'TSNonNullExpression' ||
          current.type === 'ParenthesizedExpression' ||
          current.type === 'ChainExpression'
        ) {
          current = current.expression;
        } else {
          break;
        }
      }
      if (current.type !== 'Identifier') {
        return false;
      }
      return isState(current.name) || isAlias(current.name);
    };

    const addAliases = (pattern: AstNode, source: AstNode | null | undefined): void => {
      if (source !== null && source !== undefined && isStateRooted(source)) {
        for (const id of listPatternNames(pattern)) {
          const declaring = findScope(id);
          if (declaring !== undefined) {
            const names = aliases.get(declaring) ?? new Set<string>();
            names.add(id);
            aliases.set(declaring, names);
          }
        }
      }
    };

    const checkWrite = (target: AstNode): void => {
      if (target.type === 'Identifier') {
        if (resolveLocal(target.name) !== undefined) {
          return;
        }
        const kind = lookupBinding(scope, target.name)?.binding.kind;
        if (kind === 'state') {
          writes.add(target.name);
        } else {
          this.reportError(
            'handler-assign',
            `${name} assigns ${target.name}, which is not a state field or a local`,
            target,
          );
        }
        return;
      }
      if (target.type === 'MemberExpression') {
        const root = findRootName(target);
        if (root !== undefined && (isState(root.name) || isAlias(root.name))) {
          this.reportError(
            'handler-mutate',
            `${name} changes ${root.name} in place; assign a new value instead`,
            target,
          );
        }
        return;
      }
      for (const id of listPatternNodes(target)) {
        checkWrite(id);
      }
    };

    const nestedTypes = new Set([
      'FunctionExpression',
      'ArrowFunctionExpression',
      'FunctionDeclaration',
      'ClassDeclaration',
      'ClassExpression',
    ]);
    const awaitBlockers = new Set([
      'IfStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'SwitchStatement',
      'ConditionalExpression',
      'LogicalExpression',
    ]);

    /** Walks a node, an array of nodes or a field that holds neither. */
    const visit = (value: unknown, ancestors: AstNode[], nested: boolean): void => {
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item, ancestors, nested);
        }
        return;
      }
      if (!isAstNode(value)) {
        return;
      }
      const node = value;
      const type = node.type;
      // Types are erased.
      if (
        type.startsWith('TS') &&
        ![
          'TSAsExpression',
          'TSSatisfiesExpression',
          'TSNonNullExpression',
          'TSTypeAssertion',
        ].includes(type)
      ) {
        return;
      }
      const next = [...ancestors, node];
      switch (node.type) {
        case 'Identifier': {
          const declaredEnd = resolveLocal(node.name);
          if (declaredEnd !== undefined) {
            if (!nested) {
              references.push({ name: node.name, at: node.start, declaredEnd });
            }
            return;
          }
          classify(node.name, node);
          if (!chained.has(node)) {
            recordProps(node, []);
          }
          return;
        }
        case 'MemberExpression':
          // Record the longest static props path of a chain once, at its outermost member.
          if (!node.computed && !chained.has(node)) {
            const names: string[] = [];
            let current: Expression = node;
            while (current.type === 'MemberExpression' && !current.computed) {
              names.unshift(current.property.name);
              chained.add(current);
              current = current.object;
            }
            if (current.type === 'Identifier') {
              chained.add(current);
              recordProps(current, names);
            }
          }
          visit(node.object, next, nested);
          if (node.computed) {
            visit(node.property, next, nested);
          }
          return;
        case 'Property':
          if (node.computed) {
            visit(node.key, next, nested);
          }
          visit(node.value, next, nested);
          return;
        case 'LabeledStatement':
          visit(node.body, next, nested);
          return;
        case 'BreakStatement':
        case 'ContinueStatement':
          return;
        case 'BlockStatement':
        case 'Program': {
          const block = new Map<string, number>();
          declareBlock(node.body, block);
          scopes.push(block);
          visit(node.body, next, nested);
          scopes.pop();
          return;
        }
        case 'ForStatement':
        case 'ForInStatement':
        case 'ForOfStatement': {
          const loop = new Map<string, number>();
          const init = node.type === 'ForStatement' ? node.init : node.left;
          if (init?.type === 'VariableDeclaration') {
            declareBlock([init], loop);
          }
          scopes.push(loop);
          if (node.type !== 'ForStatement' && node.left.type === 'VariableDeclaration') {
            addAliases(node.left.declarations[0].id, node.right);
          }
          const parts: (AstNode | null)[] =
            node.type === 'ForStatement'
              ? [node.init, node.test, node.update, node.body]
              : [node.left, node.right, node.body];
          for (const child of parts) {
            if (child?.type === 'VariableDeclaration') {
              for (const declarator of child.declarations) {
                visit(declarator.init, next, nested);
              }
            } else {
              visit(child, next, nested);
            }
          }
          scopes.pop();
          return;
        }
        case 'CatchClause': {
          const clause = new Map<string, number>();
          if (node.param) {
            for (const id of listPatternNames(node.param)) {
              clause.set(id, node.start);
            }
          }
          scopes.push(clause);
          visit(node.body, next, nested);
          scopes.pop();
          return;
        }
        case 'VariableDeclarator':
          addAliases(node.id, node.init);
          visit(collectPatternDefaults(node.id), next, nested);
          visit(node.init, next, nested);
          return;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression': {
          const inner = new Map<string, number>();
          for (const param of node.params) {
            for (const id of listPatternNames(param)) {
              inner.set(id, node.start);
            }
          }
          if (node.type === 'FunctionExpression' && node.id) {
            inner.set(node.id.name, node.start);
          }
          scopes.push(inner);
          visit(node.body, next, true);
          scopes.pop();
          return;
        }
        case 'AssignmentExpression':
          checkWrite(node.left);
          if (node.operator === '=' && node.left.type === 'Identifier') {
            // `let t; t = items[0];`
            addAliases(node.left, node.right);
          }
          if (node.left.type === 'Identifier' && node.operator === '=') {
            // A plain write does not read the target.
          } else {
            visit(node.left, next, nested);
          }
          visit(node.right, next, nested);
          return;
        case 'UpdateExpression':
          checkWrite(node.argument);
          visit(node.argument, next, nested);
          return;
        case 'CallExpression': {
          const callee = node.callee;
          if (callee.type === 'MemberExpression' && !callee.computed) {
            const root = findRootName(callee.object);
            if (
              root !== undefined &&
              (isState(root.name) || isAlias(root.name)) &&
              MUTATORS.has(callee.property.name)
            ) {
              this.reportError(
                'handler-mutate',
                `${name} calls ${callee.property.name}() on ${root.name}; assign a new value instead`,
                node,
              );
            }
            if (
              callee.object.type === 'Identifier' &&
              resolveLocal(callee.object.name) === undefined &&
              IMPURE[callee.object.name]?.has(callee.property.name)
            ) {
              this.reportError(
                'handler-impure',
                `${callee.object.name}.${callee.property.name}() makes ${name} replay differently; use await Random or await Time`,
                node,
              );
            }
          }
          break;
        }
        case 'NewExpression':
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === 'Date' &&
            node.arguments.length === 0 &&
            resolveLocal('Date') === undefined
          ) {
            this.reportError(
              'handler-impure',
              `new Date() makes ${name} replay differently; use await Time.now()`,
              node,
            );
          }
          break;
        case 'AwaitExpression': {
          if (nested) {
            break;
          }
          let blocker: AstNode | undefined;
          for (const ancestor of ancestors) {
            if (awaitBlockers.has(ancestor.type)) {
              blocker = ancestor;
            }
          }
          if (blocker !== undefined) {
            this.reportError(
              'await-placement',
              `An await inside ${blocker.type} is not allowed in the first version; await at the top level of ${name} or in a try block`,
              node,
            );
          }
          let callee: Root | undefined;
          if (node.argument.type === 'CallExpression') {
            const root = findRootName(node.argument.callee);
            if (root !== undefined && resolveLocal(root.name) === undefined) {
              callee = this.resolveModule(root.name);
            }
            if (callee?.kind === 'import' && node.argument.callee.type === 'MemberExpression') {
              callee = { ...callee, name: this.readText(node.argument.callee) };
            }
          }
          if (callee === undefined) {
            this.reportError(
              'await-callee',
              'The awaited callee must be an import or a module-level function',
              node.argument,
            );
          }
          awaits.push({ node, callee });
          break;
        }
        default:
          break;
      }
      for (const key of Object.keys(node)) {
        if (
          key === 'type' ||
          key === 'start' ||
          key === 'end' ||
          key === 'range' ||
          key === 'typeAnnotation' ||
          key === 'returnType' ||
          key === 'typeArguments' ||
          key === 'typeParameters'
        ) {
          continue;
        }
        const child: unknown = Reflect.get(node, key);
        visit(child, next, nested || nestedTypes.has(type));
      }
    };

    visit(fn.body, [], false);

    // Split at each await: locals declared before it and read after it ride in the payload.
    const segments: HandlerPart[] = [{ tag: name, carried: [], awaits: undefined }];
    for (const [index, entry] of awaits.entries()) {
      const carried = new Set<string>();
      for (const reference of references) {
        if (reference.declaredEnd < entry.node.start && reference.at > entry.node.end) {
          carried.add(reference.name);
        }
      }
      segments.push({ tag: `${name}$${index + 1}`, carried: [...carried], awaits: entry.callee });
    }
    const freeList: Handler['free'] = [];
    for (const [id, kind] of free) {
      freeList.push({ name: id, kind, paths: minimizePaths(propsPaths.get(id) ?? []) });
    }
    return {
      name,
      params,
      async: fn.async,
      free: freeList,
      writes: [...writes],
      segments,
      span: { start: fn.start, end: fn.end },
    };
  }
}

interface ViewContext {
  open: string[];
  namespace: Namespace;
  inHead: boolean;
  loopDepth: number;
}

// ---------------------------------------------------------------------------------------------
// Helpers

function hasTextHole(nodes: readonly Node[]): boolean {
  for (const node of nodes) {
    if (node.kind === 'text-hole') {
      return true;
    }
    if (node.kind === 'condition' && (hasTextHole(node.then) || hasTextHole(node.else))) {
      return true;
    }
    if (node.kind === 'for' && hasTextHole(node.body)) {
      return true;
    }
  }
  return false;
}

function addModifier(modifiers: EventModifier[], modifier: EventModifier): boolean {
  for (const other of modifiers) {
    if (other.kind === modifier.kind) {
      return false;
    }
  }
  modifiers.push(modifier);
  return true;
}

/** `e.preventDefault();` or `e.stopPropagation();` */
function readEventModifier(
  statement: AstNode,
  param: string | undefined,
): EventModifier | undefined {
  if (param === undefined || statement.type !== 'ExpressionStatement') {
    return undefined;
  }
  const call = statement.expression;
  if (
    call.type !== 'CallExpression' ||
    call.arguments.length > 0 ||
    call.optional ||
    call.callee.type !== 'MemberExpression' ||
    call.callee.computed ||
    call.callee.optional ||
    call.callee.object.type !== 'Identifier' ||
    call.callee.object.name !== param
  ) {
    return undefined;
  }
  if (call.callee.property.name === 'preventDefault') {
    return { kind: 'prevent' };
  }
  if (call.callee.property.name === 'stopPropagation') {
    return { kind: 'stop' };
  }
  return undefined;
}

const KEY_FLAGS: Record<string, string | undefined> = {
  ctrlKey: 'Ctrl',
  altKey: 'Alt',
  shiftKey: 'Shift',
  metaKey: 'Meta',
};

const KEY_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];

/** `e.key === 'Escape'`, joined with `&&` to `e.ctrlKey`, `e.altKey`, `e.shiftKey`, `e.metaKey`. */
function readKeyFilter(test: Expression, param: string): string | undefined {
  const flags = new Set<string>();
  let key: string | undefined;
  const queue: Expression[] = [test];
  while (queue.length > 0) {
    let part = queue.pop();
    while (part?.type === 'ParenthesizedExpression') {
      part = part.expression;
    }
    if (part === undefined) {
      break;
    }
    if (part.type === 'LogicalExpression') {
      if (part.operator !== '&&') {
        return undefined;
      }
      queue.push(part.left, part.right);
      continue;
    }
    if (part.type === 'MemberExpression') {
      const flag = readEventMember(part, param);
      const name = flag === undefined ? undefined : KEY_FLAGS[flag];
      if (name === undefined || flags.has(name)) {
        return undefined;
      }
      flags.add(name);
      continue;
    }
    if (
      part.type === 'BinaryExpression' &&
      part.operator === '===' &&
      part.left.type === 'MemberExpression' &&
      readEventMember(part.left, param) === 'key' &&
      part.right.type === 'Literal' &&
      typeof part.right.value === 'string' &&
      part.right.value !== '' &&
      key === undefined
    ) {
      key = part.right.value;
      continue;
    }
    return undefined;
  }
  if (key === undefined) {
    return undefined;
  }
  let filter = '';
  for (const name of KEY_ORDER) {
    if (flags.has(name)) {
      filter += `${name}+`;
    }
  }
  return filter + key;
}

/** The property of `param.<name>`, or undefined for any other member. */
function readEventMember(node: AstNode, param: string): string | undefined {
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    !node.optional &&
    node.object.type === 'Identifier' &&
    node.object.name === param
  ) {
    return node.property.name;
  }
  return undefined;
}

/** True when the argument reads the event other than as a whole member path. */
function readsEventOutsidePath(argument: AstNode, param: string): boolean {
  let node: AstNode = argument;
  while (node.type === 'ParenthesizedExpression') {
    node = node.expression;
  }
  if (node.type === 'Identifier') {
    return false;
  }
  if (node.type === 'MemberExpression') {
    let root: AstNode = node;
    while (root.type === 'MemberExpression') {
      if (root.computed && mentionsName(root.property, param)) {
        return true;
      }
      root = root.object;
    }
    return root.type === 'Identifier' ? false : mentionsName(root, param);
  }
  return mentionsName(node, param);
}

function mentionsName(node: unknown, name: string): boolean {
  if (typeof node !== 'object' || node === null) {
    return false;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      if (mentionsName(item, name)) {
        return true;
      }
    }
    return false;
  }
  const record = node as { type?: unknown; name?: unknown };
  if (record.type === 'Identifier' && record.name === name) {
    return true;
  }
  for (const value of Object.values(record)) {
    if (mentionsName(value, name)) {
      return true;
    }
  }
  return false;
}

function readModule(program: Program): ModuleScope {
  const module: ModuleScope = {
    imports: new Map(),
    consts: new Map(),
    functions: new Map(),
    components: new Map(),
  };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        let imported = '*';
        if (specifier.type === 'ImportDefaultSpecifier') {
          imported = 'default';
        } else if (specifier.type === 'ImportSpecifier') {
          imported = readExportName(specifier.imported);
        }
        module.imports.set(specifier.local.name, {
          source: statement.source.value,
          imported,
          typeOnly:
            statement.importKind === 'type' ||
            ('importKind' in specifier && specifier.importKind === 'type'),
        });
      }
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      if (/^[A-Z]/.test(declaration.id.name)) {
        module.components.set(declaration.id.name, declaration);
      } else {
        module.functions.set(declaration.id.name, declaration);
      }
    } else if (declaration?.type === 'VariableDeclaration' && declaration.kind === 'const') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          module.consts.set(declarator.id.name, declarator.init);
        }
      }
    }
  }
  return module;
}

/** Parses an imported module and lists its exported components. */
function readForeignModule(read: ImportedModule | undefined): ForeignModule | undefined {
  if (read === undefined) {
    return undefined;
  }
  const program = parseSync(read.file, read.source, { lang: 'tsx' }).program;
  const module = readModule(program);
  const exports = new Map<string, FunctionNode>();
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration;
      if (declaration.type === 'FunctionDeclaration') {
        exports.set('default', declaration);
      } else if (declaration.type === 'Identifier') {
        const fn = module.components.get(declaration.name);
        if (fn !== undefined) {
          exports.set('default', fn);
        }
      }
    } else if (statement.type === 'ExportNamedDeclaration') {
      const declaration = statement.declaration;
      if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
        exports.set(declaration.id.name, declaration);
      }
      for (const specifier of statement.specifiers) {
        const fn = module.components.get(readExportName(specifier.local));
        const name = readExportName(specifier.exported);
        if (fn !== undefined && statement.source === null) {
          exports.set(name, fn);
        }
      }
    }
  }
  return { file: read.file, source: read.source, module, exports };
}

/** The expression a function returns when its body is one expression or one `return`. */
function findReturnedExpression(fn: FunctionLike): Expression | undefined {
  const body = fn.body;
  if (body === null) {
    return undefined;
  }
  if (body.type !== 'BlockStatement') {
    return body;
  }
  const only = body.body.length === 1 ? body.body[0] : undefined;
  if (only?.type !== 'ReturnStatement') {
    return undefined;
  }
  return only.argument ?? undefined;
}

/** The name of a non-computed property key: `a` in `{ a }`, `'b'` in `{ 'b': c }`. */
function readKeyName(key: PropertyKey): string {
  if (key.type === 'Identifier') {
    return key.name;
  }
  if (key.type === 'Literal') {
    return String(key.value);
  }
  return '';
}

/** Tells whether a value read from an AST field is a node. */
function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

function readExportName(name: ModuleExportName): string {
  return name.type === 'Literal' ? name.value : name.name;
}

/** The default value expressions in a binding pattern: `b` in `{ a = b }`. */
function collectPatternDefaults(pattern: AstNode | null): Expression[] {
  const out: Expression[] = [];
  if (pattern?.type === 'AssignmentPattern') {
    out.push(pattern.right);
    for (const item of collectPatternDefaults(pattern.left)) {
      out.push(item);
    }
  } else if (pattern?.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      const inner = property.type === 'Property' ? property.value : property.argument;
      for (const item of collectPatternDefaults(inner)) {
        out.push(item);
      }
    }
  } else if (pattern?.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      for (const item of collectPatternDefaults(element)) {
        out.push(item);
      }
    }
  }
  return out;
}

function isStateless(fn: FunctionNode): boolean {
  for (const statement of fn.body?.body ?? []) {
    if (statement.type === 'FunctionDeclaration') {
      return false;
    }
    if (statement.type === 'VariableDeclaration' && statement.kind === 'let') {
      return false;
    }
  }
  return true;
}

function collectNonBlank(children: AstNode[]): AstNode[] {
  const out: AstNode[] = [];
  for (const child of children) {
    if (!(child.type === 'JSXText' && child.value.trim() === '')) {
      out.push(child);
    }
  }
  return out;
}

function hasComputedSegment(segments: Segment[]): boolean {
  for (const segment of segments) {
    if (typeof segment === 'object') {
      return true;
    }
  }
  return false;
}

function isJsxish(node: AstNode): boolean {
  while (node.type === 'ParenthesizedExpression') {
    node = node.expression;
  }
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    return true;
  }
  if (node.type === 'ConditionalExpression') {
    return isJsxish(node.consequent) || isJsxish(node.alternate);
  }
  if (node.type === 'LogicalExpression') {
    return isJsxish(node.right);
  }
  return false;
}

function resolveMemberRoot(name: JSXMemberExpression, module: ModuleScope): Root {
  const parts: string[] = [];
  let current: JSXMemberExpression | JSXIdentifier = name;
  while (current.type === 'JSXMemberExpression') {
    parts.unshift(current.property.name);
    current = current.object;
  }
  parts.unshift(current.name);
  return {
    kind: 'import',
    name: parts.join('.'),
    source: module.imports.get(current.name)?.source ?? '?',
  };
}

function listPatternNames(pattern: AstNode | null): string[] {
  const names: string[] = [];
  for (const node of listPatternNodes(pattern)) {
    names.push(node.name);
  }
  return names;
}

function listPatternNodes(pattern: AstNode | null): IdentifierNode[] {
  if (pattern === null) {
    return [];
  }
  switch (pattern.type) {
    case 'Identifier':
      return [pattern];
    case 'AssignmentPattern':
      return listPatternNodes(pattern.left);
    case 'RestElement':
      return listPatternNodes(pattern.argument);
    case 'ArrayPattern': {
      const out: IdentifierNode[] = [];
      for (const element of pattern.elements) {
        for (const node of listPatternNodes(element)) {
          out.push(node);
        }
      }
      return out;
    }
    case 'ObjectPattern': {
      const out: IdentifierNode[] = [];
      for (const property of pattern.properties) {
        for (const node of listPatternNodes(
          property.type === 'RestElement' ? property : property.value,
        )) {
          out.push(node);
        }
      }
      return out;
    }
    case 'TSParameterProperty':
      return listPatternNodes(pattern.parameter);
    default:
      return [];
  }
}

/** JSX text whitespace, as React and Solid trim it. */
function normalizeJsxText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);
  const kept: string[] = [];
  for (const [index, line] of lines.entries()) {
    let text = line.replaceAll('\t', ' ');
    if (index !== 0) {
      text = text.trimStart();
    }
    if (index !== lines.length - 1) {
      text = text.trimEnd();
    }
    if (text !== '') {
      kept.push(text);
    }
  }
  return kept.join(' ');
}

/** Tells whether an expression calls an impure global such as `Math.random`. */
function hasImpureCall(expr: Expr): boolean {
  switch (expr.kind) {
    case 'literal':
      return false;
    case 'path':
      for (const segment of expr.segments) {
        if (
          typeof segment === 'object' &&
          segment.kind === 'index' &&
          hasImpureCall(segment.value)
        ) {
          return true;
        }
      }
      return false;
    case 'unary':
      return hasImpureCall(expr.arg);
    case 'binary':
    case 'logical':
      return hasImpureCall(expr.left) || hasImpureCall(expr.right);
    case 'conditional':
      return hasImpureCall(expr.test) || hasImpureCall(expr.then) || hasImpureCall(expr.else);
    case 'template':
      return hasImpureCallIn(expr.exprs);
    case 'object':
      for (const entry of expr.entries) {
        if (hasImpureCall(entry.value)) {
          return true;
        }
      }
      return false;
    case 'array':
      return hasImpureCallIn(expr.items);
    case 'property':
      return hasImpureCall(expr.receiver);
    case 'method':
      return hasImpureCall(expr.receiver) || hasImpureCallIn(expr.args);
    default:
      // `call`
      if (expr.helper === 'inlined') {
        return hasImpureCall(expr.body);
      }
      return expr.impure === true || hasImpureCallIn(expr.args);
  }
}

function hasImpureCallIn(exprs: Expr[]): boolean {
  for (const expr of exprs) {
    if (hasImpureCall(expr)) {
      return true;
    }
  }
  return false;
}

/** Drops paths that have a prefix in the set: a reference check on the prefix covers them. */
function minimizePaths(paths: Path[]): Path[] {
  const printed: string[] = [];
  for (const path of paths) {
    printed.push(printPath(path));
  }
  const out: Path[] = [];
  const seen = new Set<string>();
  for (const [index, path] of paths.entries()) {
    const text = printed[index];
    if (seen.has(text)) {
      continue;
    }
    let covered = false;
    for (const other of printed) {
      if (other !== text && text.startsWith(`${other}.`)) {
        covered = true;
      }
    }
    if (covered) {
      continue;
    }
    seen.add(text);
    out.push(path);
  }
  return out;
}

/** Reads one `*.idlip.tsx` file into the view IR. */
export function analyze(file: string, source: string, options: AnalyzeOptions = {}): ModuleIR {
  const parsed = parseSync(file, source, { lang: 'tsx' });
  const analyzer = new Analyzer(file, source, parsed.program, options);
  for (const error of parsed.errors) {
    analyzer.diagnostics.push({
      rule: 'parse',
      severity: 'error',
      message: error.message,
      span: { start: error.labels[0]?.start ?? 0, end: error.labels[0]?.end ?? 0 },
    });
  }
  const components: Component[] = [];
  for (const statement of parsed.program.body) {
    const exported =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration';
    const declaration = exported ? statement.declaration : statement;
    if (
      declaration?.type === 'FunctionDeclaration' &&
      declaration.id &&
      /^[A-Z]/.test(declaration.id.name)
    ) {
      components.push(analyzer.analyzeComponent(declaration.id.name, declaration, exported));
    }
  }
  return { file, components, diagnostics: analyzer.diagnostics };
}
