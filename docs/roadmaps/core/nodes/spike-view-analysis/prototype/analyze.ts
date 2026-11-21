// Spike prototype: reads the function components of a `*.idlip.tsx` file with oxc-parser and
// prints their state fields, derived values, handlers, view tree, path set per hole and
// diagnostics. Run: node analyze.ts <file> [--json]
import { readFileSync } from 'node:fs';
import { parseSync } from 'oxc-parser';
import type {
  Attr,
  Component,
  Diagnostic,
  Event,
  Expr,
  FreeKind,
  Handler,
  HandlerPart,
  Hole,
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
} from './ir.ts';
import { findImpliedWrapper, findNestingProblem } from './nesting.ts';

// oxc returns ESTree nodes; the prototype reads them untyped.
// oxlint-disable-next-line typescript/no-explicit-any
type AstNode = any;

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

/** Pure globals callable in a hole. `Math.*` except `Math.random` is handled apart. */
const PURE_GLOBALS = new Set(['String', 'Number', 'Boolean']);

/** Non-mutating methods that take no function argument, callable on any value in a hole. */
const METHODS: ReadonlySet<string> = new Set([
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

const COMPARISON = new Set(['===', '!==', '==', '!=', '<', '<=', '>', '>=']);
const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '**']);

// ---------------------------------------------------------------------------------------------
// Scopes

interface ModuleScope {
  imports: Map<string, { source: string; typeOnly: boolean }>;
  consts: Map<string, AstNode>;
  functions: Map<string, AstNode>;
  components: Map<string, AstNode>;
}

/** What a name in a hole or event resolves to. */
type Binding =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'state'; name: string }
  | { kind: 'derived'; name: string; node: AstNode }
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
    if (binding !== undefined) return { binding, owner: current };
  }
  return undefined;
}

/** Loop roots map to the list they iterate, so item reads resolve to `list.*.field`. */
interface LoopInfo {
  base: Path | undefined;
  fallback: Path[];
}

/** Thrown to abandon inlining a helper whose body leaves the closed grammar. */
class InlineAbort extends Error {}

// ---------------------------------------------------------------------------------------------
// Analyzer

class Analyzer {
  readonly source: string;
  readonly file: string;
  readonly module: ModuleScope;
  readonly diagnostics: Diagnostic[] = [];
  readonly loops = new WeakMap<Root, LoopInfo>();
  /** Diagnostics go here while trying to inline a helper. */
  sink: Diagnostic[] | undefined;
  holes: Hole[] = [];
  childPosition = 0;
  inlineStack: string[] = [];

  constructor(file: string, source: string, program: AstNode) {
    this.file = file;
    this.source = source;
    this.module = readModule(program);
  }

  report(
    rule: string,
    severity: Severity,
    message: string,
    node: { start: number; end: number },
  ): void {
    if (this.sink !== undefined) {
      if (severity === 'error') throw new InlineAbort(rule);
      return;
    }
    this.diagnostics.push({ rule, severity, message, span: { start: node.start, end: node.end } });
  }

  error(rule: string, message: string, node: AstNode): Expr {
    this.report(rule, 'error', message, node);
    return { kind: 'literal', value: undefined };
  }

  text(node: { start: number; end: number }): string {
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
        if (node.regex !== undefined || node.bigint !== undefined) {
          return this.error(
            'hole-literal',
            'Regular expression and bigint literals are not in the closed grammar',
            node,
          );
        }
        return { kind: 'literal', value: node.value };
      case 'TemplateLiteral': {
        const quasis: string[] = [];
        for (const quasi of node.quasis) quasis.push(quasi.value.cooked);
        const exprs: Expr[] = [];
        for (const expression of node.expressions) exprs.push(this.lower(expression, scope));
        return { kind: 'template', quasis, exprs };
      }
      case 'Identifier':
      case 'MemberExpression':
        return this.lowerReference(node, scope);
      case 'UnaryExpression':
        if (!['!', '-', '+', 'typeof'].includes(node.operator)) {
          return this.error(
            'hole-operator',
            `The operator ${node.operator} is not in the closed grammar`,
            node,
          );
        }
        return { kind: 'unary', op: node.operator, arg: this.lower(node.argument, scope) };
      case 'BinaryExpression':
        if (!COMPARISON.has(node.operator) && !ARITHMETIC.has(node.operator)) {
          return this.error(
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
            this.error(
              'hole-object',
              'Object literals in holes take plain keys and values: no spread, methods or computed keys',
              property,
            );
            continue;
          }
          const key =
            property.key.type === 'Identifier' ? property.key.name : String(property.key.value);
          entries.push({ key, value: this.lower(property.value, scope) });
        }
        return { kind: 'object', entries };
      }
      case 'ArrayExpression': {
        const items: Expr[] = [];
        for (const element of node.elements) {
          if (element === null || element.type === 'SpreadElement') {
            this.error(
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
        return this.error('hole-closure', 'A closure is not allowed in a hole', node);
      case 'JSXElement':
      case 'JSXFragment':
        return this.error(
          'hole-jsx',
          'JSX is allowed only as a view child or a condition branch',
          node,
        );
      case 'AssignmentExpression':
      case 'UpdateExpression':
      case 'SequenceExpression':
        return this.error('hole-statement', 'Assignments are not allowed in a hole', node);
      case 'AwaitExpression':
      case 'YieldExpression':
      case 'NewExpression':
      case 'TaggedTemplateExpression':
        return this.error('hole-effect', `${node.type} is not in the closed grammar`, node);
      default:
        return this.error('hole-grammar', `${node.type} is not in the closed grammar`, node);
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
      if (current.optional) optional = true;
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
      return this.extend(base, segments, optional, node);
    }
    const name: string = current.name;
    if (name === 'undefined') return { kind: 'literal', value: undefined };
    if (name === 'NaN') return { kind: 'literal', value: Number.NaN };
    if (name === 'Infinity') return { kind: 'literal', value: Number.POSITIVE_INFINITY };
    const found = lookupBinding(scope, name);
    if (found === undefined) {
      const root = this.resolveModule(name);
      if (root !== undefined) {
        if (root.kind === 'module' && this.module.functions.has(name)) {
          return this.error(
            'hole-function-value',
            `The function ${name} is used as a value; call it or move it to a handler`,
            current,
          );
        }
        if (root.kind === 'module' && this.module.components.has(name)) {
          return this.error(
            'hole-function-value',
            `The component ${name} is used as a value`,
            current,
          );
        }
        return { kind: 'path', root, segments, optional };
      }
      if (GLOBALS.has(name)) {
        return this.error(
          'hole-global',
          `The global ${name} is not in the closed grammar; wrap it in a helper`,
          current,
        );
      }
      return this.error(
        'hole-unknown',
        `${name} is not a state field, derived value, prop, loop variable, import or module-level binding`,
        current,
      );
    }
    const { binding, owner } = found;
    switch (binding.kind) {
      case 'expr':
        return this.extend(binding.expr, segments, optional, node);
      case 'state':
        return { kind: 'path', root: { kind: 'state', name }, segments, optional };
      case 'props':
        return { kind: 'path', root: { kind: 'props' }, segments, optional };
      case 'derived':
        return this.extend(
          this.lowerDerived(binding.name, binding.node, owner),
          segments,
          optional,
          node,
        );
      case 'props-subst': {
        const [first, ...rest] = segments;
        if (typeof first !== 'string') {
          return this.error(
            'props-whole',
            'A stateless component must read props by name, not pass the props object along',
            current,
          );
        }
        const value = binding.values.get(first);
        if (value === undefined) {
          if (binding.messages.has(first) || first === 'children') {
            return this.error(
              'hole-message',
              `props.${first} is allowed only in an event prop or as a view child`,
              node,
            );
          }
          return { kind: 'literal', value: undefined };
        }
        return this.extend(value, rest, optional, node);
      }
      case 'handler':
        return this.error(
          'hole-handler',
          `The handler ${name} is allowed only in an event prop`,
          current,
        );
      case 'message':
      case 'reset':
        return this.error('hole-message', `${name} is allowed only in an event prop`, current);
      case 'nodes':
        return this.error('hole-children', `${name} is allowed only as a view child`, current);
      case 'hidden':
        return this.error(binding.rule, binding.why, current);
    }
  }

  /** Adds segments to an expression that is a path; anything else leaves the grammar. */
  extend(base: Expr, segments: Segment[], optional: boolean, node: AstNode): Expr {
    if (segments.length === 0) return base;
    if (base.kind === 'path') {
      return {
        kind: 'path',
        root: base.root,
        segments: [...base.segments, ...segments],
        optional: base.optional || optional,
      };
    }
    if (base.kind === 'literal' && base.value === undefined) return base;
    // `.length` is allowed on any value, like the allowed methods.
    if (segments.length === 1 && segments[0] === 'length') {
      return { kind: 'property', receiver: base, name: 'length' };
    }
    if (this.sink !== undefined) throw new InlineAbort('member');
    return this.error(
      'hole-member',
      'Property access is allowed only on a path, not on a computed value',
      node,
    );
  }

  lowerDerived(name: string, node: AstNode, owner: Scope): Expr {
    const cached = owner.derivedCache.get(name);
    if (cached !== undefined) return cached;
    if (owner.derivedBusy.has(name)) {
      return this.error('derived-cycle', `The derived value ${name} reads itself`, node);
    }
    owner.derivedBusy.add(name);
    let expr: Expr;
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
      expr = this.error(
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

  resolveModule(name: string): Root | undefined {
    const imported = this.module.imports.get(name);
    if (imported !== undefined) return { kind: 'import', name, source: imported.source };
    if (
      this.module.consts.has(name) ||
      this.module.functions.has(name) ||
      this.module.components.has(name)
    ) {
      return { kind: 'module', name };
    }
    return undefined;
  }

  lowerCall(node: AstNode, scope: Scope): Expr {
    let callee = node.callee;
    while (callee.type === 'ParenthesizedExpression' || callee.type === 'TSNonNullExpression')
      callee = callee.expression;
    // Find the callee's root.
    let root: Root | undefined;
    let helperNode: AstNode | undefined;
    if (callee.type === 'Identifier') {
      const found = lookupBinding(scope, callee.name);
      if (found !== undefined) {
        const kind = found.binding.kind;
        if (kind === 'handler')
          return this.error(
            'hole-handler',
            `The handler ${callee.name} cannot be called in a hole`,
            node,
          );
        return this.error(
          'hole-call',
          `${callee.name} is not a helper: a helper is an import or a module-level function`,
          node,
        );
      }
      root = this.resolveModule(callee.name);
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
          return this.error(
            'hole-global',
            `The global ${callee.name} is not in the closed grammar; wrap it in a helper`,
            node,
          );
        }
        return this.error('hole-unknown', `${callee.name} is not defined`, node);
      }
      if (root.kind === 'module') {
        helperNode = this.module.functions.get(callee.name);
        if (helperNode === undefined) {
          const constant = this.module.consts.get(callee.name);
          if (
            constant?.type === 'ArrowFunctionExpression' ||
            constant?.type === 'FunctionExpression'
          )
            helperNode = constant;
        }
        if (helperNode === undefined) {
          return this.error('hole-call', `${callee.name} is not a function`, node);
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
          root = {
            kind: 'import',
            name: [object.name, ...names].join('.'),
            source: imported.source,
          };
        } else if (object.name === 'Math' && names.length === 1) {
          if (names[0] === 'random') {
            return this.error(
              'hole-impure',
              'Math.random() in a hole renders differently each time',
              node,
            );
          }
          return {
            kind: 'call',
            callee: { kind: 'global', name: `Math.${names[0]}` },
            args: this.lowerArgs(node, scope),
            helper: 'args',
          };
        } else if (GLOBALS.has(object.name) && !METHODS.has(callee.property.name)) {
          return this.error(
            'hole-global',
            `${object.name}.${names.join('.')} is not in the closed grammar; wrap it in a helper`,
            node,
          );
        }
      }
      if (root === undefined && METHODS.has(callee.property.name)) {
        return {
          kind: 'method',
          receiver: this.lower(callee.object, scope),
          name: callee.property.name,
          args: this.lowerArgs(node, scope),
        };
      }
      if (root === undefined) {
        return this.error(
          'hole-method',
          `The method call ${this.text(callee)}() is not in the closed grammar; use a helper or <For>`,
          node,
        );
      }
    } else {
      return this.error('hole-call', 'The callee of a helper call must be a name', node);
    }
    const args = this.lowerArgs(node, scope);
    // Inline a helper whose body is one return expression in the closed grammar.
    if (helperNode !== undefined) {
      const body = this.tryInline(helperNode, args, root as Root);
      if (body !== undefined)
        return { kind: 'call', callee: root as Root, args, helper: 'inlined', body };
    }
    return { kind: 'call', callee: root as Root, args, helper: 'args' };
  }

  lowerArgs(node: AstNode, scope: Scope): Expr[] {
    const args: Expr[] = [];
    for (const argument of node.arguments) {
      if (argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression') {
        this.error('helper-closure', 'A closure argument to a helper is not allowed', argument);
        continue;
      }
      if (argument.type === 'SpreadElement') {
        this.error('hole-spread', 'Spread arguments are not in the closed grammar', argument);
        continue;
      }
      args.push(this.lower(argument, scope));
    }
    return args;
  }

  tryInline(fn: AstNode, args: Expr[], root: Root): Expr | undefined {
    let returned: AstNode | undefined;
    if (fn.body.type !== 'BlockStatement') {
      returned = fn.body;
    } else if (fn.body.body.length === 1 && fn.body.body[0].type === 'ReturnStatement') {
      returned = fn.body.body[0].argument;
    }
    if (returned === undefined || returned === null) return undefined;
    const name = root.kind === 'module' ? root.name : '';
    if (this.inlineStack.includes(name) || this.inlineStack.length > 8) return undefined;
    const scope = createScope(undefined);
    for (const [index, param] of fn.params.entries()) {
      if (param.type !== 'Identifier') return undefined;
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
      if (error instanceof InlineAbort) return undefined;
      throw error;
    } finally {
      this.sink = saved;
      this.inlineStack.pop();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Paths

  pathsOf(expr: Expr): Path[] {
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
        if (root.kind === 'state') out.push({ root: 'state', segments: [root.name, ...segments] });
        else if (root.kind === 'props') out.push({ root: 'props', segments });
        else if (root.kind === 'loop') {
          const info = this.loops.get(root);
          if (info?.base !== undefined) {
            out.push({ root: info.base.root, segments: [...info.base.segments, ...segments] });
          } else if (info !== undefined) {
            for (const path of info.fallback) out.push(path);
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
        for (const item of expr.exprs) this.collectPaths(item, out);
        return;
      case 'object':
        for (const entry of expr.entries) this.collectPaths(entry.value, out);
        return;
      case 'array':
        for (const item of expr.items) this.collectPaths(item, out);
        return;
      case 'property':
        this.collectPaths(expr.receiver, out);
        return;
      case 'method':
        this.collectPaths(expr.receiver, out);
        for (const item of expr.args) this.collectPaths(item, out);
        return;
      case 'call':
        if (expr.helper === 'inlined') this.collectPaths(expr.body, out);
        else for (const item of expr.args) this.collectPaths(item, out);
        return;
    }
  }

  createHole(node: AstNode, scope: Scope): Hole {
    const expr = this.lower(node, scope);
    const hole: Hole = {
      id: this.holes.length,
      expr,
      paths: this.pathsOf(expr),
      span: { start: node.start, end: node.end },
    };
    // The analysis never produces `dynamic` for the closed grammar. Until `dynamic-paths`
    // lands, one would be an error.
    if (hole.paths === 'dynamic') {
      this.report('hole-dynamic', 'error', 'This hole needs runtime path tracking', node);
    }
    this.holes.push(hole);
    return hole;
  }

  // -------------------------------------------------------------------------------------------
  // Events

  lowerEvent(
    name: string,
    mode: 'on' | 'latest',
    value: AstNode,
    scope: Scope,
    passValue = false,
  ): Event | undefined {
    const span: Span = { start: value.start, end: value.end };
    let expression = value.type === 'JSXExpressionContainer' ? value.expression : value;
    while (expression.type === 'ParenthesizedExpression') expression = expression.expression;
    // `on:click={add}` or `on:click={props.onRemove}`.
    if (expression.type === 'Identifier' || expression.type === 'MemberExpression') {
      const target = this.resolveTarget(expression, scope);
      if (target === undefined) return undefined;
      if ('event' in target) return { ...target.event, name, mode, span };
      // A subscription value is the payload of a bare handler reference.
      const args: Expr[] = passValue
        ? [{ kind: 'path', root: { kind: 'event' }, segments: [], optional: false }]
        : [];
      return { name, mode, target, args, paths: [], modifiers: [], span };
    }
    if (expression.type !== 'ArrowFunctionExpression' || expression.async) {
      this.error(
        'event-closure',
        'An event prop takes a handler, or an arrow whose body is one handler call',
        expression,
      );
      return undefined;
    }
    if (
      expression.params.length > 1 ||
      (expression.params.length === 1 && expression.params[0].type !== 'Identifier')
    ) {
      this.error(
        'event-param',
        'An event arrow takes at most one parameter, the event, as a plain name',
        expression,
      );
      return undefined;
    }
    let body = expression.body;
    if (
      body.type === 'BlockStatement' &&
      body.body.length === 1 &&
      body.body[0].type === 'ExpressionStatement'
    ) {
      body = body.body[0].expression;
    }
    if (body.type !== 'CallExpression') {
      this.error('event-closure', 'The body of an event arrow must be one handler call', body);
      return undefined;
    }
    const target = this.resolveTarget(body.callee, scope);
    if (target === undefined) return undefined;
    const inner = createScope(scope);
    if (expression.params.length === 1) {
      inner.names.set(expression.params[0].name, {
        kind: 'expr',
        expr: { kind: 'path', root: { kind: 'event' }, segments: [], optional: false },
      });
    }
    if ('event' in target) {
      if (body.arguments.length > 0) {
        this.error(
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
        this.error('event-closure', 'A closure is not allowed as a handler argument', argument);
        continue;
      }
      args.push(this.lower(argument, inner));
    }
    const paths: Path[] = [];
    for (const argument of args) this.collectPaths(argument, paths);
    return { name, mode, target, args, paths: minimizePaths(paths), modifiers: [], span };
  }

  resolveTarget(node: AstNode, scope: Scope): Target | { event: Event } | undefined {
    if (node.type === 'Identifier') {
      const found = lookupBinding(scope, node.name);
      if (found?.binding.kind === 'handler') return { kind: 'handler', name: node.name };
      if (found?.binding.kind === 'reset') return { kind: 'reset' };
      if (found?.binding.kind === 'message') return { event: found.binding.event };
    }
    if (node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier') {
      const found = lookupBinding(scope, node.object.name);
      if (found?.binding.kind === 'props') return { kind: 'prop', name: node.property.name };
      if (found?.binding.kind === 'props-subst') {
        const event = found.binding.messages.get(node.property.name);
        if (event !== undefined) return { event };
      }
    }
    this.error(
      'event-target',
      `${this.text(node)} is not a handler, a message prop or reset`,
      node,
    );
    return undefined;
  }

  // -------------------------------------------------------------------------------------------
  // View

  lowerChildren(children: AstNode[], scope: Scope, context: ViewContext): Node[] {
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
        if (child.expression.type === 'JSXEmptyExpression') continue;
        for (const node of this.lowerBranch(child.expression, scope, context)) out.push(node);
        continue;
      }
      if (child.type === 'JSXSpreadChild') {
        this.error('jsx-spread', 'Spread children are not allowed', child);
        continue;
      }
      for (const node of this.lowerJsx(child, scope, context)) out.push(node);
    }
    return out;
  }

  /** Lowers a view position: JSX, a condition block, children, or a text hole. */
  lowerBranch(node: AstNode, scope: Scope, context: ViewContext): Node[] {
    while (node.type === 'ParenthesizedExpression') node = node.expression;
    if (node.type === 'JSXElement' || node.type === 'JSXFragment')
      return this.lowerJsx(node, scope, context);
    if (
      node.type === 'Literal' &&
      (node.value === null || node.value === false || node.value === '')
    )
      return [];
    if (node.type === 'Identifier' && node.name === 'undefined') return [];
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
        this.error(
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
    if (nodes !== undefined) return nodes;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property.name === 'map'
    ) {
      this.error('view-map', 'Lists are written with <For each key>, not .map()', node);
      return [];
    }
    this.checkTableText(context, node);
    return [{ kind: 'text-hole', hole: this.createHole(node, scope) }];
  }

  resolveChildren(node: AstNode, scope: Scope): Node[] | undefined {
    if (node.type === 'Identifier') {
      const found = lookupBinding(scope, node.name);
      if (found?.binding.kind === 'nodes') return found.binding.nodes;
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property.name === 'children' &&
      node.object.type === 'Identifier'
    ) {
      const found = lookupBinding(scope, node.object.name);
      if (found?.binding.kind === 'props-subst') return found.binding.children;
      if (found?.binding.kind === 'props') {
        // Analyzed on its own, a stateless component's children are an empty slot.
        if (found.binding.stateless) return [];
        this.error(
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

  lowerJsx(node: AstNode, scope: Scope, context: ViewContext): Node[] {
    if (node.type === 'JSXFragment') return this.lowerChildren(node.children, scope, context);
    const opening = node.openingElement;
    const nameNode = opening.name;
    if (nameNode.type === 'JSXMemberExpression') {
      const root = memberRoot(nameNode, this.module);
      this.checkImportedComponent(root, nameNode);
      return [this.lowerChild(node, root, undefined, scope, context)];
    }
    if (nameNode.type === 'JSXNamespacedName') {
      this.error('jsx-namespace-tag', 'Namespaced tags are not supported', nameNode);
      return [];
    }
    const tag: string = nameNode.name;
    if (BLOCKS.has(tag) && this.module.imports.get(tag)?.source === 'idlip') {
      return this.lowerBlock(tag, node, scope, context);
    }
    if (/^[A-Z]/.test(tag)) {
      const local = this.module.components.get(tag);
      if (local !== undefined && isStateless(local))
        return this.inlineComponent(tag, local, node, scope, context);
      const root = this.resolveModule(tag);
      if (root === undefined) {
        this.error(
          'component-unknown',
          `<${tag}> is not an imported or module-level component`,
          nameNode,
        );
        return [];
      }
      this.checkImportedComponent(root, nameNode);
      return [this.lowerChild(node, root, local, scope, context)];
    }
    if (tag === 'window' || tag === 'document')
      return [this.lowerGlobal(tag, node, scope, context)];
    return [this.lowerElement(tag, node, scope, context)];
  }

  /**
   * An imported component must come from an `.idlip.tsx` file. The production analysis reads
   * that file and applies the stateless rule; the prototype reads one file and keeps a child.
   */
  checkImportedComponent(root: Root, node: AstNode): void {
    if (root.kind !== 'import') return;
    if (!/\.idlip(\.tsx)?$/.test(root.source)) {
      this.report(
        'component-import',
        'error',
        `${root.name} comes from ${root.source}, which is not an .idlip.tsx component`,
        node,
      );
    }
  }

  lowerElement(tag: string, node: AstNode, scope: Scope, context: ViewContext): Node {
    let namespace = context.namespace;
    if (tag === 'svg') namespace = 'svg';
    else if (tag === 'math') namespace = 'mathml';
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
        this.error('jsx-spread', 'Spread attributes are not allowed', attribute);
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
        if (event === undefined) continue;
        for (const other of events) {
          if (other.name === event.name) {
            this.error(
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
        attrs.push({ name: attrName, value: { kind: 'static', value: String(value.value) } });
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
        this.error('attr-jsx', 'An attribute value cannot be JSX', value);
      }
    }
    const inner: ViewContext = {
      ...context,
      namespace: tag === 'foreignObject' ? 'html' : namespace,
      open: [...context.open, tag],
    };
    const children = this.lowerChildren(node.children, scope, inner);
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
      span: { start: node.start, end: node.end },
    };
  }

  lowerRef(
    value: AstNode,
    scope: Scope,
    context: ViewContext,
    attribute: AstNode,
  ): Ref | undefined {
    if (value?.type === 'Literal' && typeof value.value === 'string')
      return { kind: 'name', name: value.value };
    const expression = value?.type === 'JSXExpressionContainer' ? value.expression : undefined;
    if (expression?.type === 'Literal' && typeof expression.value === 'string')
      return { kind: 'name', name: expression.value };
    if (
      expression?.type === 'ArrayExpression' &&
      expression.elements.length === 2 &&
      context.loopDepth > 0
    ) {
      const [first, second] = expression.elements;
      if (first.type === 'Literal' && typeof first.value === 'string') {
        const key = this.lower(second, scope);
        if (key.kind === 'path' && key.root.kind === 'loop')
          return { kind: 'tuple', name: first.value, key };
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

  lowerHtml(value: AstNode, scope: Scope, attribute: AstNode): Hole | undefined {
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

  lowerGlobal(tag: 'window' | 'document', node: AstNode, scope: Scope, context: ViewContext): Node {
    const events: Event[] = [];
    for (const attribute of node.openingElement.attributes) {
      const name = attribute.name;
      if (
        attribute.type === 'JSXAttribute' &&
        name.type === 'JSXNamespacedName' &&
        (name.namespace.name === 'on' || name.namespace.name === 'latest')
      ) {
        const event = this.lowerEvent(name.name.name, name.namespace.name, attribute.value, scope);
        if (event !== undefined) events.push(event);
      } else {
        this.error('global-attr', `<${tag}> takes event props only`, attribute);
      }
    }
    if (node.children.length > 0) this.error('global-children', `<${tag}> takes no children`, node);
    void context;
    return { kind: 'global', target: tag, events };
  }

  lowerBlock(tag: string, node: AstNode, scope: Scope, context: ViewContext): Node[] {
    const attrs = new Map<string, AstNode>();
    const events: Event[] = [];
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.error('jsx-spread', 'Spread attributes are not allowed', attribute);
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
          attribute.value,
          scope,
          tag === 'Subscribe',
        );
        if (event !== undefined) events.push(event);
        continue;
      }
      attrs.set(name.name, attribute);
    }
    const expressionOf = (name: string): AstNode | undefined => {
      const value = attrs.get(name)?.value;
      return value?.type === 'JSXExpressionContainer' ? value.expression : (value ?? undefined);
    };
    switch (tag) {
      case 'For':
        return this.lowerFor(node, expressionOf, scope, context);
      case 'Try': {
        const handler = expressionOf('catch');
        const body = this.lowerChildren(node.children, scope, context);
        if (
          handler?.type !== 'ArrowFunctionExpression' ||
          handler.params.length === 0 ||
          handler.params.length > 2
        ) {
          this.error(
            'try-catch',
            '<Try> takes catch={(error, reset) => <jsx>}',
            node.openingElement,
          );
          return body;
        }
        const inner = createScope(scope);
        const [errorParam, resetParam] = handler.params;
        inner.names.set(errorParam.name, {
          kind: 'expr',
          expr: {
            kind: 'path',
            root: { kind: 'local', name: errorParam.name },
            segments: [],
            optional: false,
          },
        });
        if (resetParam !== undefined) inner.names.set(resetParam.name, { kind: 'reset' });
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
        const to = expressionOf('to');
        let source: Root | undefined;
        if (to?.type === 'Identifier' && lookupBinding(scope, to.name) === undefined)
          source = this.resolveModule(to.name);
        if (source === undefined) {
          this.error(
            'subscribe-source',
            '<Subscribe to> takes an imported or module-level async generator',
            to ?? node.openingElement,
          );
          return [];
        }
        const inputNode = expressionOf('input');
        const keyNode = expressionOf('key');
        const input = inputNode === undefined ? undefined : this.createHole(inputNode, scope);
        const key = keyNode === undefined ? undefined : this.createHole(keyNode, scope);
        if (input !== undefined && input.paths !== 'dynamic' && input.paths.length > 0) {
          const keyPaths: string[] = [];
          if (key !== undefined && key.paths !== 'dynamic') {
            for (const path of key.paths) keyPaths.push(printPath(path));
          }
          for (const path of input.paths) {
            if (!keyPaths.includes(printPath(path))) {
              this.error(
                'subscribe-input-key',
                `<Subscribe input> reads ${printPath(path)}, so key must read it too`,
                inputNode,
              );
            }
          }
        }
        if (node.children.length > 0)
          this.error('subscribe-children', '<Subscribe> takes no children', node);
        return [{ kind: 'subscribe', source, input, key, events }];
      }
    }
    return [];
  }

  lowerFor(
    node: AstNode,
    expressionOf: (name: string) => AstNode | undefined,
    scope: Scope,
    context: ViewContext,
  ): Node[] {
    const eachNode = expressionOf('each');
    const keyNode = expressionOf('key');
    if (eachNode === undefined) {
      this.error('for-each', '<For> needs each', node.openingElement);
      return [];
    }
    if (keyNode?.type !== 'Literal' || typeof keyNode.value !== 'string') {
      this.error(
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
      render.params.length > 2
    ) {
      this.error(
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
      if (own.length === 1) base = own[0];
    }
    const inner = createScope(scope);
    const [itemParam, indexParam] = render.params;
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
          this.error(
            'for-param',
            'A <For> item pattern takes plain fields only, without defaults or rest',
            property,
          );
          continue;
        }
        inner.names.set(property.value.name, {
          kind: 'expr',
          expr: { ...itemExpr, segments: [property.key.name] },
        });
      }
    } else {
      this.error('for-param', 'The <For> item is a name or an object pattern', itemParam);
    }
    let indexName: string | undefined;
    if (indexParam !== undefined) {
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
        key: keyNode?.value ?? '',
        item: itemName,
        index: indexName,
        namespace: context.namespace,
        body,
      },
    ];
  }

  /** A stateful child component: a child block with its own model slot. */
  lowerChild(
    node: AstNode,
    component: Root,
    local: AstNode | undefined,
    scope: Scope,
    context: ViewContext,
  ): Node {
    const props: { name: string; value: Hole }[] = [];
    const messages: Event[] = [];
    let slot: Slot | undefined;
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.error('jsx-spread', 'Spread props are not allowed', attribute);
        continue;
      }
      const name: string =
        attribute.name.type === 'JSXNamespacedName'
          ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
          : attribute.name.name;
      const value = attribute.value;
      const expression = value?.type === 'JSXExpressionContainer' ? value.expression : value;
      if (/^on[A-Z]/.test(name)) {
        const event = this.lowerEvent(name, 'on', value, scope);
        if (event !== undefined) messages.push(event);
        continue;
      }
      if (expression === null || expression === undefined) {
        props.push({
          name,
          value: this.createHole(
            { type: 'Literal', value: true, start: attribute.start, end: attribute.end },
            scope,
          ),
        });
        continue;
      }
      if (name === 'key') {
        slot = { kind: 'key', hole: this.createHole(expression, scope) };
        continue;
      }
      props.push({ name, value: this.createHole(expression, scope) });
    }
    if (collectNonBlank(node.children).length > 0) {
      this.error('child-children', 'Children of a stateful component are not supported yet', node);
    }
    slot ??=
      context.loopDepth > 0
        ? { kind: 'for-key' }
        : { kind: 'position', index: this.childPosition++ };
    void local;
    return { kind: 'child', component, props, messages, slot };
  }

  /** Inlines a stateless component: its view is lowered with its props bound to the caller's expressions. */
  inlineComponent(
    tag: string,
    fn: AstNode,
    node: AstNode,
    callerScope: Scope,
    context: ViewContext,
  ): Node[] {
    if (this.inlineStack.includes(tag)) {
      this.error('component-recursive', `<${tag}> renders itself`, node.openingElement);
      return [];
    }
    const values = new Map<string, Expr>();
    const messages = new Map<string, Event>();
    for (const attribute of node.openingElement.attributes) {
      if (attribute.type === 'JSXSpreadAttribute') {
        this.error('jsx-spread', 'Spread props are not allowed', attribute);
        continue;
      }
      const name: string = attribute.name.name;
      const value = attribute.value;
      if (/^on[A-Z]/.test(name)) {
        const event = this.lowerEvent(name, 'on', value, callerScope);
        if (event !== undefined) messages.set(name, event);
        continue;
      }
      if (value === null) values.set(name, { kind: 'literal', value: true });
      else if (value.type === 'Literal') values.set(name, { kind: 'literal', value: value.value });
      else values.set(name, this.lower(value.expression, callerScope));
    }
    const children = this.lowerChildren(node.children, callerScope, context);
    // The component sees only module bindings and its props.
    const scope = createScope(undefined);
    const param = fn.params[0];
    if (param?.type === 'Identifier') {
      scope.names.set(param.name, { kind: 'props-subst', values, messages, children });
    } else if (param?.type === 'ObjectPattern') {
      for (const property of param.properties) {
        if (property.type !== 'Property' || property.value.type !== 'Identifier') continue;
        const key: string = property.key.name;
        const local: string = property.value.name;
        const event = messages.get(key);
        if (key === 'children') scope.names.set(local, { kind: 'nodes', nodes: children });
        else if (event !== undefined) scope.names.set(local, { kind: 'message', event });
        else
          scope.names.set(local, {
            kind: 'expr',
            expr: values.get(key) ?? { kind: 'literal', value: undefined },
          });
      }
    }
    let returned: AstNode | undefined;
    for (const statement of fn.body.body) {
      if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
        for (const declarator of statement.declarations) {
          if (declarator.id.type === 'Identifier')
            scope.names.set(declarator.id.name, {
              kind: 'derived',
              name: declarator.id.name,
              node: declarator.init,
            });
        }
      } else if (statement.type === 'ReturnStatement') {
        returned = statement.argument;
      }
    }
    if (returned === undefined || returned === null) return [];
    this.inlineStack.push(tag);
    const nodes = this.lowerBranch(returned, scope, context);
    this.inlineStack.pop();
    return nodes;
  }

  // -------------------------------------------------------------------------------------------
  // Components

  analyzeComponent(name: string, fn: AstNode, exported: boolean): Component {
    this.holes = [];
    this.childPosition = 0;
    const scope = createScope(undefined);
    // Initial values see props, imports and module constants only.
    const initScope = createScope(undefined);
    let props: Component['props'] = { kind: 'none' };
    if (fn.params.length > 1)
      this.error('props-count', 'A component takes one parameter, props', fn.params[1]);
    const param = fn.params[0];
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
          this.error(
            'props-pattern',
            'A props pattern takes plain fields only, without defaults or rest',
            property,
          );
          continue;
        }
        fields.push({ key: property.key.name, local: property.value.name });
        if (stateless && property.key.name === 'children') {
          scope.names.set(property.value.name, { kind: 'nodes', nodes: [] });
          continue;
        }
        if (/^on[A-Z]/.test(property.key.name)) {
          const event: Event = {
            name: '',
            mode: 'on',
            target: { kind: 'prop', name: property.key.name },
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
            segments: [property.key.name],
            optional: false,
          },
        };
        scope.names.set(property.value.name, binding);
        initScope.names.set(property.value.name, binding);
      }
      props = { kind: 'pattern', fields };
    } else if (param !== undefined) {
      this.error('props-pattern', 'The props parameter is a name or an object pattern', param);
    }

    // Read the body: declarations and one return.
    const lets: AstNode[] = [];
    const consts: AstNode[] = [];
    const functions: AstNode[] = [];
    let returned: AstNode | undefined;
    for (const statement of fn.body.body) {
      if (returned !== undefined) {
        this.error(
          'body-statement',
          'The return must be the last statement of a component',
          statement,
        );
        continue;
      }
      switch (statement.type) {
        case 'VariableDeclaration':
          if (statement.kind === 'let') lets.push(statement);
          else if (statement.kind === 'const') consts.push(statement);
          else
            this.error(
              'body-var',
              'Use let for state and const for derived values, not var',
              statement,
            );
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
          this.error(
            'body-statement',
            `A component body holds declarations and one return, not ${statement.type}`,
            statement,
          );
      }
    }

    // State fields.
    const stateNodes: { name: string; init: AstNode; node: AstNode }[] = [];
    for (const declaration of lets) {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier') {
          this.error(
            'body-destructure',
            'State is declared one name at a time; destructuring is not allowed',
            declarator.id,
          );
          continue;
        }
        const stateName: string = declarator.id.name;
        if (declarator.id.typeAnnotation) {
          this.error(
            'let-annotation',
            `Write let ${stateName} = value satisfies T as T, not let ${stateName}: T`,
            declarator.id,
          );
        }
        if (declarator.init === null) {
          this.error('let-init', `The state field ${stateName} needs an initial value`, declarator);
          continue;
        }
        if (
          declarator.init.type === 'TSAsExpression' &&
          declarator.init.expression.type !== 'TSSatisfiesExpression'
        ) {
          this.error(
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
          this.error(
            'body-destructure',
            'Derived values are declared one name at a time; destructuring is not allowed',
            declarator.id,
          );
          continue;
        }
        scope.names.set(declarator.id.name, {
          kind: 'derived',
          name: declarator.id.name,
          node: declarator.init,
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
      scope.names.set(declaration.id.name, { kind: 'handler', name: declaration.id.name });
      initScope.names.set(declaration.id.name, {
        kind: 'hidden',
        rule: 'init-scope',
        why: 'An initial value cannot read a handler',
      });
    }

    const state: Component['state'] = [];
    for (const field of stateNodes) {
      state.push({ name: field.name, init: this.lower(field.init, initScope), assigned: false });
    }
    const derived: Component['derived'] = [];
    for (const derivedName of derivedNames) {
      const binding = scope.names.get(derivedName) as { kind: 'derived'; node: AstNode };
      derived.push({
        name: derivedName,
        expr: this.lowerDerived(derivedName, binding.node, scope),
      });
    }
    const handlers: Handler[] = [];
    for (const declaration of functions) handlers.push(this.analyzeHandler(declaration, scope));

    // A let that no handler assigns is a warning.
    const written = new Set<string>();
    for (const handler of handlers) for (const name of handler.writes) written.add(name);
    for (const [index, field] of state.entries()) {
      field.assigned = written.has(field.name);
      if (!field.assigned) {
        const node = stateNodes[index]!.node;
        this.report(
          'let-unassigned',
          'warning',
          `The state field ${field.name} is never assigned; make it a const`,
          node,
        );
      }
    }

    let view: Node[] = [];
    if (returned === undefined || returned.argument === null) {
      this.error('body-return', `The component ${name} must end with return <jsx>`, fn);
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

  analyzeHandler(fn: AstNode, scope: Scope): Handler {
    const name: string = fn.id.name;
    const free = new Map<string, FreeKind>();
    const propsPaths = new Map<string, Path[]>();
    const chained = new WeakSet<AstNode>();
    const writes = new Set<string>();
    const awaits: { node: AstNode; callee: Root | undefined }[] = [];
    /** Each local reference: name, position, and where its declaration ends. */
    const references: { name: string; at: number; declaredEnd: number }[] = [];
    const params: string[] = [];
    if (fn.generator)
      this.error('handler-generator', `The handler ${name} cannot be a generator`, fn);

    // Each scope maps a local name to the end of its declaration.
    const scopes: Map<string, number>[] = [];
    const paramScope = new Map<string, number>();
    for (const param of fn.params) {
      for (const id of patternNames(param)) {
        paramScope.set(id, fn.start);
        params.push(id);
      }
    }
    scopes.push(paramScope);

    const resolveLocal = (id: string): number | undefined => {
      for (let index = scopes.length - 1; index >= 0; index--) {
        const end = scopes[index]!.get(id);
        if (end !== undefined) return end;
      }
      return undefined;
    };

    /** Records a props path read by the handler: `props.x.y` or a pattern field. */
    const recordProps = (id: AstNode, names: string[]): void => {
      if (resolveLocal(id.name) !== undefined) return;
      const binding = lookupBinding(scope, id.name)?.binding;
      let base: Segment[] | undefined;
      if (binding?.kind === 'props') base = [];
      else if (
        binding?.kind === 'expr' &&
        binding.expr.kind === 'path' &&
        binding.expr.root.kind === 'props'
      ) {
        base = binding.expr.segments;
      }
      if (base === undefined) return;
      const list = propsPaths.get(id.name) ?? [];
      list.push({ root: 'props', segments: [...base, ...names] });
      propsPaths.set(id.name, list);
    };

    const classify = (id: string, node: AstNode): void => {
      const found = lookupBinding(scope, id);
      if (found !== undefined) {
        const binding = found.binding;
        let kind: FreeKind;
        if (binding.kind === 'state') kind = 'state';
        else if (binding.kind === 'derived') kind = 'derived';
        else if (binding.kind === 'handler') kind = 'handler';
        else kind = 'props';
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
      this.error(
        'handler-free',
        `${id} in ${name} is not state, a derived value, a prop, a handler, an import or a module-level binding`,
        node,
      );
    };

    const declareBlock = (statements: AstNode[], target: Map<string, number>): void => {
      for (const statement of statements) {
        const declaration =
          statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        if (declaration?.type === 'VariableDeclaration') {
          for (const declarator of declaration.declarations) {
            for (const id of patternNames(declarator.id)) target.set(id, declarator.end);
          }
        } else if (
          declaration?.type === 'FunctionDeclaration' ||
          declaration?.type === 'ClassDeclaration'
        ) {
          if (declaration.id) target.set(declaration.id.name, declaration.start);
        }
      }
    };

    /** The root identifier of a member chain, if any. */
    const rootOf = (node: AstNode): AstNode | undefined => {
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

    const checkWrite = (target: AstNode): void => {
      if (target.type === 'Identifier') {
        if (resolveLocal(target.name) !== undefined) return;
        const kind = lookupBinding(scope, target.name)?.binding.kind;
        if (kind === 'state') writes.add(target.name);
        else
          this.error(
            'handler-assign',
            `${name} assigns ${target.name}, which is not a state field or a local`,
            target,
          );
        return;
      }
      if (target.type === 'MemberExpression') {
        const root = rootOf(target);
        if (root !== undefined && isState(root.name)) {
          this.error(
            'handler-mutate',
            `${name} changes ${root.name} in place; assign a new value instead`,
            target,
          );
        }
        return;
      }
      for (const id of patternNodes(target)) checkWrite(id);
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

    const visit = (node: AstNode, ancestors: AstNode[], nested: boolean): void => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, ancestors, nested);
        return;
      }
      if (typeof node.type !== 'string') return;
      const type: string = node.type;
      // Types are erased.
      if (
        type.startsWith('TS') &&
        ![
          'TSAsExpression',
          'TSSatisfiesExpression',
          'TSNonNullExpression',
          'TSTypeAssertion',
        ].includes(type)
      )
        return;
      const next = [...ancestors, node];
      switch (type) {
        case 'Identifier': {
          const declaredEnd = resolveLocal(node.name);
          if (declaredEnd !== undefined) {
            if (!nested) references.push({ name: node.name, at: node.start, declaredEnd });
            return;
          }
          classify(node.name, node);
          if (!chained.has(node)) recordProps(node, []);
          return;
        }
        case 'MemberExpression':
          // Record the longest static props path of a chain once, at its outermost member.
          if (!node.computed && !chained.has(node)) {
            const names: string[] = [];
            let current = node;
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
          if (node.computed) visit(node.property, next, nested);
          return;
        case 'Property':
          if (node.computed) visit(node.key, next, nested);
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
          const init = type === 'ForStatement' ? node.init : node.left;
          if (init?.type === 'VariableDeclaration') declareBlock([init], loop);
          scopes.push(loop);
          for (const key of ['init', 'test', 'update', 'left', 'right', 'body']) {
            const child = node[key];
            if (child?.type === 'VariableDeclaration') {
              for (const declarator of child.declarations) visit(declarator.init, next, nested);
            } else {
              visit(child, next, nested);
            }
          }
          scopes.pop();
          return;
        }
        case 'CatchClause': {
          const clause = new Map<string, number>();
          if (node.param) for (const id of patternNames(node.param)) clause.set(id, node.start);
          scopes.push(clause);
          visit(node.body, next, nested);
          scopes.pop();
          return;
        }
        case 'VariableDeclarator':
          visitPatternDefaults(node.id, next, nested);
          visit(node.init, next, nested);
          return;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression': {
          const inner = new Map<string, number>();
          for (const param of node.params)
            for (const id of patternNames(param)) inner.set(id, node.start);
          if (type === 'FunctionExpression' && node.id) inner.set(node.id.name, node.start);
          scopes.push(inner);
          visit(node.body, next, true);
          scopes.pop();
          return;
        }
        case 'AssignmentExpression':
          checkWrite(node.left);
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
            const root = rootOf(callee.object);
            if (root !== undefined && isState(root.name) && MUTATORS.has(callee.property.name)) {
              this.error(
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
              this.error(
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
            this.error(
              'handler-impure',
              `new Date() makes ${name} replay differently; use await Time.now()`,
              node,
            );
          }
          break;
        case 'AwaitExpression': {
          if (nested) break;
          let blocker: AstNode | undefined;
          for (const ancestor of ancestors) {
            if (awaitBlockers.has(ancestor.type)) blocker = ancestor;
          }
          if (blocker !== undefined) {
            this.error(
              'await-placement',
              `An await inside ${blocker.type} is not allowed in the first version; await at the top level of ${name} or in a try block`,
              node,
            );
          }
          let callee: Root | undefined;
          if (node.argument.type === 'CallExpression') {
            const root = rootOf(node.argument.callee);
            if (root !== undefined && resolveLocal(root.name) === undefined)
              callee = this.resolveModule(root.name);
            if (callee?.kind === 'import' && node.argument.callee.type === 'MemberExpression') {
              callee = { ...callee, name: this.text(node.argument.callee) };
            }
          }
          if (callee === undefined) {
            this.error(
              'await-callee',
              'The awaited callee must be an import or a module-level function',
              node.argument,
            );
          }
          awaits.push({ node, callee });
          break;
        }
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
        )
          continue;
        visit(node[key], next, nested || nestedTypes.has(type));
      }
    };

    const visitPatternDefaults = (
      pattern: AstNode,
      ancestors: AstNode[],
      nested: boolean,
    ): void => {
      if (pattern?.type === 'AssignmentPattern') visit(pattern.right, ancestors, nested);
      if (pattern?.type === 'ObjectPattern') {
        for (const property of pattern.properties)
          visitPatternDefaults(property.value ?? property.argument, ancestors, nested);
      }
      if (pattern?.type === 'ArrayPattern')
        for (const element of pattern.elements) visitPatternDefaults(element, ancestors, nested);
    };

    visit(fn.body, [], false);

    // Split at each await: locals declared before it and read after it ride in the payload.
    const segments: HandlerPart[] = [{ tag: name, carried: [], awaits: undefined }];
    for (const [index, entry] of awaits.entries()) {
      const carried = new Set<string>();
      for (const reference of references) {
        if (reference.declaredEnd < entry.node.start && reference.at > entry.node.end)
          carried.add(reference.name);
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

function readModule(program: AstNode): ModuleScope {
  const module: ModuleScope = {
    imports: new Map(),
    consts: new Map(),
    functions: new Map(),
    components: new Map(),
  };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        module.imports.set(specifier.local.name, {
          source: statement.source.value,
          typeOnly: statement.importKind === 'type' || specifier.importKind === 'type',
        });
      }
      continue;
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      if (/^[A-Z]/.test(declaration.id.name))
        module.components.set(declaration.id.name, declaration);
      else module.functions.set(declaration.id.name, declaration);
    } else if (declaration?.type === 'VariableDeclaration' && declaration.kind === 'const') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier')
          module.consts.set(declarator.id.name, declarator.init);
      }
    }
  }
  return module;
}

function isStateless(fn: AstNode): boolean {
  for (const statement of fn.body.body) {
    if (statement.type === 'FunctionDeclaration') return false;
    if (statement.type === 'VariableDeclaration' && statement.kind === 'let') return false;
  }
  return true;
}

function collectNonBlank(children: AstNode[]): AstNode[] {
  const out: AstNode[] = [];
  for (const child of children) {
    if (!(child.type === 'JSXText' && child.value.trim() === '')) out.push(child);
  }
  return out;
}

function hasComputedSegment(segments: Segment[]): boolean {
  for (const segment of segments) if (typeof segment === 'object') return true;
  return false;
}

function isJsxish(node: AstNode): boolean {
  while (node.type === 'ParenthesizedExpression') node = node.expression;
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') return true;
  if (node.type === 'ConditionalExpression')
    return isJsxish(node.consequent) || isJsxish(node.alternate);
  if (node.type === 'LogicalExpression') return isJsxish(node.right);
  return false;
}

function memberRoot(name: AstNode, module: ModuleScope): Root {
  const parts: string[] = [];
  let current = name;
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

function patternNames(pattern: AstNode): string[] {
  const names: string[] = [];
  for (const node of patternNodes(pattern)) names.push(node.name);
  return names;
}

function patternNodes(pattern: AstNode): AstNode[] {
  if (pattern === null || pattern === undefined) return [];
  switch (pattern.type) {
    case 'Identifier':
      return [pattern];
    case 'AssignmentPattern':
      return patternNodes(pattern.left);
    case 'RestElement':
      return patternNodes(pattern.argument);
    case 'ArrayPattern': {
      const out: AstNode[] = [];
      for (const element of pattern.elements)
        for (const node of patternNodes(element)) out.push(node);
      return out;
    }
    case 'ObjectPattern': {
      const out: AstNode[] = [];
      for (const property of pattern.properties) {
        for (const node of patternNodes(
          property.type === 'RestElement' ? property : property.value,
        ))
          out.push(node);
      }
      return out;
    }
    case 'TSParameterProperty':
      return patternNodes(pattern.parameter);
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
    if (index !== 0) text = text.trimStart();
    if (index !== lines.length - 1) text = text.trimEnd();
    if (text !== '') kept.push(text);
  }
  return kept.join(' ');
}

/** Drops paths that have a prefix in the set: a reference check on the prefix covers them. */
function minimizePaths(paths: Path[]): Path[] {
  const printed: string[] = [];
  for (const path of paths) printed.push(printPath(path));
  const out: Path[] = [];
  const seen = new Set<string>();
  for (const [index, path] of paths.entries()) {
    const text = printed[index]!;
    if (seen.has(text)) continue;
    let covered = false;
    for (const other of printed) {
      if (other !== text && text.startsWith(`${other}.`)) covered = true;
    }
    if (covered) continue;
    seen.add(text);
    out.push(path);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Printing

function printSegment(segment: Segment): string {
  if (typeof segment === 'string') return segment;
  if (segment.kind === 'item') return '*';
  if (segment.kind === 'index') return `[${printExpr(segment.value)}]`;
  return `[${segment.field}=${printExpr(segment.value)}]`;
}

export function printPath(path: Path): string {
  const parts: string[] = [];
  if (path.root === 'props') parts.push('props');
  for (const segment of path.segments) parts.push(printSegment(segment));
  return parts.join('.');
}

function printRoot(root: Root): string {
  switch (root.kind) {
    case 'state':
      return root.name;
    case 'props':
      return 'props';
    case 'loop':
      return root.name;
    case 'event':
      return '$event';
    case 'form':
      return `$form.${root.name}`;
    case 'local':
      return root.name;
    case 'global':
      return root.name;
    case 'import':
      return root.name;
    case 'module':
      return root.name;
  }
}

export function printExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'literal':
      return expr.value === undefined ? 'undefined' : JSON.stringify(expr.value);
    case 'path': {
      let text = printRoot(expr.root);
      for (const segment of expr.segments) {
        const printed = printSegment(segment);
        text += printed.startsWith('[') ? printed : `.${printed}`;
      }
      return text;
    }
    case 'unary':
      return `${expr.op}${expr.op === 'typeof' ? ' ' : ''}${printExpr(expr.arg)}`;
    case 'binary':
    case 'logical':
      return `(${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)})`;
    case 'conditional':
      return `(${printExpr(expr.test)} ? ${printExpr(expr.then)} : ${printExpr(expr.else)})`;
    case 'template': {
      let text = '`';
      for (const [index, quasi] of expr.quasis.entries()) {
        text += quasi;
        if (index < expr.exprs.length) text += `\${${printExpr(expr.exprs[index]!)}}`;
      }
      return `${text}\``;
    }
    case 'object': {
      const parts: string[] = [];
      for (const entry of expr.entries) parts.push(`${entry.key}: ${printExpr(entry.value)}`);
      return `{ ${parts.join(', ')} }`;
    }
    case 'array': {
      const parts: string[] = [];
      for (const item of expr.items) parts.push(printExpr(item));
      return `[${parts.join(', ')}]`;
    }
    case 'property':
      return `${printExpr(expr.receiver)}.${expr.name}`;
    case 'method': {
      const parts: string[] = [];
      for (const item of expr.args) parts.push(printExpr(item));
      return `${printExpr(expr.receiver)}.${expr.name}(${parts.join(', ')})`;
    }
    case 'call': {
      const parts: string[] = [];
      for (const item of expr.args) parts.push(printExpr(item));
      const call = `${printRoot(expr.callee)}(${parts.join(', ')})`;
      return expr.helper === 'inlined' ? `${call} => ${printExpr(expr.body)}` : call;
    }
  }
}

function printPaths(paths: Path[] | 'dynamic'): string {
  if (paths === 'dynamic') return 'dynamic';
  if (paths.length === 0) return '(static)';
  const parts: string[] = [];
  for (const path of paths) parts.push(printPath(path));
  return parts.join(', ');
}

function printEvent(event: Event): string {
  let target: string;
  if (event.target.kind === 'handler') target = event.target.name;
  else if (event.target.kind === 'prop') target = `props.${event.target.name}`;
  else target = 'reset';
  const args: string[] = [];
  for (const arg of event.args) args.push(printExpr(arg));
  const render = event.paths.length > 0 ? `  render reads ${printPaths(event.paths)}` : '';
  return `${event.mode}:${event.name} -> ${target}(${args.join(', ')})${render}`;
}

function printNodes(nodes: Node[], indent: string, out: string[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out.push(`${indent}"${node.value}"`);
        break;
      case 'text-hole':
        out.push(`${indent}{#${node.hole.id}}`);
        break;
      case 'element': {
        const parts: string[] = [node.tag];
        if (node.namespace !== 'html') parts.push(`ns=${node.namespace}`);
        for (const attr of node.attrs) {
          parts.push(
            attr.value.kind === 'static'
              ? `${attr.name}=${JSON.stringify(attr.value.value)}`
              : `${attr.name}={#${attr.value.hole.id}}`,
          );
        }
        if (node.ref !== undefined)
          parts.push(
            node.ref.kind === 'name'
              ? `ref=${node.ref.name}`
              : `ref=[${node.ref.name}, ${printExpr(node.ref.key)}]`,
          );
        if (node.html !== undefined) parts.push(`html={#${node.html.id}}`);
        for (const event of node.events) parts.push(`[${printEvent(event)}]`);
        out.push(`${indent}<${parts.join(' ')}>`);
        printNodes(node.children, `${indent}  `, out);
        break;
      }
      case 'for':
        out.push(
          `${indent}for #${node.each.id} key=${node.key} item=${node.item}${node.index ? ` index=${node.index}` : ''}`,
        );
        printNodes(node.body, `${indent}  `, out);
        break;
      case 'condition':
        out.push(`${indent}if #${node.test.id}`);
        printNodes(node.then, `${indent}  `, out);
        if (node.else.length > 0) {
          out.push(`${indent}else`);
          printNodes(node.else, `${indent}  `, out);
        }
        break;
      case 'try':
        out.push(`${indent}try`);
        printNodes(node.body, `${indent}  `, out);
        out.push(`${indent}catch (${node.error}${node.reset ? `, ${node.reset}` : ''})`);
        printNodes(node.catch, `${indent}  `, out);
        break;
      case 'head':
        out.push(`${indent}head`);
        printNodes(node.children, `${indent}  `, out);
        break;
      case 'subscribe': {
        const events: string[] = [];
        for (const event of node.events) events.push(`[${printEvent(event)}]`);
        out.push(
          `${indent}subscribe ${printRoot(node.source)}${node.input ? ` input=#${node.input.id}` : ''}${node.key ? ` key=#${node.key.id}` : ''} ${events.join(' ')}`,
        );
        break;
      }
      case 'global': {
        const events: string[] = [];
        for (const event of node.events) events.push(`[${printEvent(event)}]`);
        out.push(`${indent}${node.target} ${events.join(' ')}`);
        break;
      }
      case 'child': {
        const parts: string[] = [];
        for (const prop of node.props) parts.push(`${prop.name}={#${prop.value.id}}`);
        for (const event of node.messages) parts.push(`[${printEvent(event)}]`);
        let slot: string;
        if (node.slot.kind === 'key') slot = `key #${node.slot.hole.id}`;
        else if (node.slot.kind === 'for-key') slot = 'for-key';
        else slot = `position ${node.slot.index}`;
        out.push(`${indent}child ${printRoot(node.component)} slot=${slot} ${parts.join(' ')}`);
        break;
      }
    }
  }
}

function locate(source: string, offset: number): string {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index++) {
    if (source[index] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return `${line}:${column}`;
}

export function analyze(file: string, source: string): ModuleIR {
  const parsed = parseSync(file, source, { lang: 'tsx' });
  const analyzer = new Analyzer(file, source, parsed.program);
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

export function printModule(ir: ModuleIR, source: string): string {
  const out: string[] = [`file ${ir.file}`];
  for (const component of ir.components) {
    out.push(
      '',
      `component ${component.name} (${component.mode}${component.exported ? ', exported' : ''})`,
    );
    if (component.props.kind === 'param') out.push(`  props: ${component.props.name}`);
    else if (component.props.kind === 'pattern') {
      const fields: string[] = [];
      for (const field of component.props.fields) {
        fields.push(field.key === field.local ? field.key : `${field.key}: ${field.local}`);
      }
      out.push(`  props: { ${fields.join(', ')} }`);
    }
    if (component.state.length > 0) out.push('  state:');
    for (const field of component.state) out.push(`    ${field.name} = ${printExpr(field.init)}`);
    if (component.derived.length > 0) out.push('  derived:');
    for (const derived of component.derived)
      out.push(`    ${derived.name} = ${printExpr(derived.expr)}`);
    if (component.handlers.length > 0) out.push('  handlers:');
    for (const handler of component.handlers) {
      const free: string[] = [];
      for (const entry of handler.free) {
        free.push(
          entry.paths.length > 0
            ? `${entry.name}:${entry.kind}(${printPaths(entry.paths)})`
            : `${entry.name}:${entry.kind}`,
        );
      }
      out.push(`    ${handler.async ? 'async ' : ''}${handler.name}(${handler.params.join(', ')})`);
      out.push(`      free: ${free.join(' ') || '-'}`);
      out.push(`      writes: ${handler.writes.join(' ') || '-'}`);
      if (handler.segments.length > 1) {
        for (const segment of handler.segments.slice(1)) {
          out.push(
            `      segment ${segment.tag} after await ${segment.awaits ? printRoot(segment.awaits) : '?'}, carries: ${segment.carried.join(' ') || '-'}`,
          );
        }
      }
    }
    out.push('  view:');
    printNodes(component.view, '    ', out);
    out.push('  holes:');
    for (const hole of component.holes) {
      out.push(
        `    #${hole.id} ${source.slice(hole.span.start, hole.span.end).replaceAll(/\s+/g, ' ')}`,
      );
      out.push(`        expr  ${printExpr(hole.expr)}`);
      out.push(`        paths ${printPaths(hole.paths)}`);
    }
  }
  out.push('', `diagnostics: ${ir.diagnostics.length}`);
  for (const diagnostic of ir.diagnostics) {
    out.push(
      `  ${locate(source, diagnostic.span.start)} ${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`,
    );
  }
  return out.join('\n');
}

// CLI.
if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').at(-1)!)) {
  const [file, flag] = process.argv.slice(2);
  if (file === undefined) {
    console.error('usage: node analyze.ts <file.idlip.tsx> [--json]');
    process.exit(2);
  }
  const source = readFileSync(file, 'utf8');
  const started = performance.now();
  const ir = analyze(file, source);
  const elapsed = performance.now() - started;
  if (flag === '--json') console.log(JSON.stringify(ir, null, 2));
  else console.log(printModule(ir, source));
  console.error(`analyzed ${source.length} bytes in ${elapsed.toFixed(1)} ms`);
}
