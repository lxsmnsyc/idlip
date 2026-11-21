// Prints view IR expressions as JS, for the server module and for client chunks.
import type { BinaryOp, Expr, Span } from '../analyze/index.ts';
import { getAccessor, getKey, getLocalName, quote } from './text.ts';

/**
 * A `<For>` row in scope. On the server, and inside a template that loops, the item is a JS
 * variable. In a binding it is read from `scope.rows[row]`.
 */
export interface Frame {
  item: string;
  index: string | undefined;
  /** The depth in `scope.rows`, or `undefined` when the item is a variable. */
  row: number | undefined;
}

export type ScopeName = 'model' | 'props' | 'rows';

/** What the printed code reads, so a chunk imports and destructures only that. */
export interface Usage {
  scope: Set<ScopeName>;
  /** Module-level helpers and constants. */
  modules: Set<string>;
  /** Local names of imports, such as `fmt` for `fmt.count`. */
  imports: Set<string>;
  /** Props fields read on the client. */
  props: Set<string>;
  /** Loop variables read. */
  vars: Set<string>;
  /** Runtime helpers: `text`, `attr`, `on`, `setAttr` and so on. */
  helpers: Set<string>;
}

export function createUsage(): Usage {
  return {
    scope: new Set(),
    modules: new Set(),
    imports: new Set(),
    props: new Set(),
    vars: new Set(),
    helpers: new Set(),
  };
}

export function mergeUsage(into: Usage, from: Usage): void {
  for (const name of from.scope) {
    into.scope.add(name);
  }
  for (const name of from.modules) {
    into.modules.add(name);
  }
  for (const name of from.imports) {
    into.imports.add(name);
  }
  for (const name of from.props) {
    into.props.add(name);
  }
  for (const name of from.vars) {
    into.vars.add(name);
  }
  for (const name of from.helpers) {
    into.helpers.add(name);
  }
}

export type Report = (rule: string, message: string, span: Span) => void;

const PRECEDENCE: Record<string, number> = {
  '??': 2,
  '||': 3,
  '&&': 4,
  '===': 8,
  '!==': 8,
  '==': 8,
  '!=': 8,
  '<': 9,
  '<=': 9,
  '>': 9,
  '>=': 9,
  '+': 11,
  '-': 11,
  '*': 12,
  '/': 12,
  '%': 12,
  '**': 13,
};

const UNARY = 14;
const MEMBER = 17;

function wrap(text: string, precedence: number, min: number): string {
  return precedence < min ? `(${text})` : text;
}

function printLiteral(value: string | number | boolean | null | undefined, min: number): string {
  if (typeof value === 'string') {
    return quote(value);
  }
  if (typeof value === 'number') {
    const text = String(value);
    return value < 0 || min >= MEMBER ? `(${text})` : text;
  }
  return value === undefined ? 'undefined' : String(value);
}

/** Prints expressions for one place: the server module or a client chunk. */
export class Emitter {
  frames: Frame[] = [];

  /** The span reported with a diagnostic. Callers set it to the hole or event they print. */
  at: Span = { start: 0, end: 0 };

  constructor(
    readonly mode: 'server' | 'client',
    readonly usage: Usage,
    readonly report: Report,
  ) {}

  fail(rule: string, message: string): string {
    this.report(rule, message, this.at);
    return 'undefined';
  }

  /** Prints `expr` so it can sit where an operator of precedence `min` binds. */
  expr(expr: Expr, min = 0): string {
    switch (expr.kind) {
      case 'literal':
        return printLiteral(expr.value, min);
      case 'path':
        return this.printPath(expr, min);
      case 'unary': {
        const operator = expr.op === 'typeof' ? 'typeof ' : expr.op;
        let arg = this.expr(expr.arg, UNARY);
        if ((expr.op === '-' || expr.op === '+') && arg.startsWith(expr.op)) {
          arg = `(${arg})`;
        }
        return wrap(`${operator}${arg}`, UNARY, min);
      }
      case 'binary':
        return this.printBinary(expr.op, expr.left, expr.right, min);
      case 'logical': {
        const precedence = PRECEDENCE[expr.op];
        const left = this.printLogicalOperand(expr.op, expr.left, precedence);
        const right = this.printLogicalOperand(expr.op, expr.right, precedence + 1);
        return wrap(`${left} ${expr.op} ${right}`, precedence, min);
      }
      case 'conditional':
        return wrap(
          `${this.expr(expr.test, 2)} ? ${this.expr(expr.then, 1)} : ${this.expr(expr.else, 1)}`,
          1,
          min,
        );
      case 'template': {
        let out = '`';
        for (const [index, quasi] of expr.quasis.entries()) {
          out += quasi.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
          const inner = expr.exprs.at(index);
          if (inner !== undefined) {
            out += `\${${this.expr(inner)}}`;
          }
        }
        return `${out}\``;
      }
      case 'object': {
        const entries: string[] = [];
        for (const entry of expr.entries) {
          entries.push(`${getKey(entry.key)}: ${this.expr(entry.value, 1)}`);
        }
        return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
      }
      case 'array': {
        const items: string[] = [];
        for (const item of expr.items) {
          items.push(this.expr(item, 1));
        }
        return `[${items.join(', ')}]`;
      }
      case 'call': {
        if (expr.helper === 'inlined') {
          return this.expr(expr.body, min);
        }
        const args: string[] = [];
        for (const arg of expr.args) {
          args.push(this.expr(arg, 1));
        }
        return `${this.printRoot(expr.callee)}(${args.join(', ')})`;
      }
      case 'method': {
        const args: string[] = [];
        for (const arg of expr.args) {
          args.push(this.expr(arg, 1));
        }
        const receiver = this.expr(expr.receiver, MEMBER);
        return `${receiver}.${expr.name}(${args.join(', ')})`;
      }
      default:
        return `${this.expr(expr.receiver, MEMBER)}.${expr.name}`;
    }
  }

  printLogicalOperand(operator: '&&' | '||' | '??', operand: Expr, min: number): string {
    const text = this.expr(operand, min);
    // `??` cannot mix with `&&` or `||` without parentheses.
    if (operand.kind === 'logical' && (operator === '??') !== (operand.op === '??')) {
      return `(${text})`;
    }
    return text;
  }

  printBinary(operator: BinaryOp, left: Expr, right: Expr, min: number): string {
    const precedence = PRECEDENCE[operator];
    // `**` is right-associative, and a unary left operand needs parentheses.
    const leftMin = operator === '**' ? UNARY + 1 : precedence;
    const rightMin = operator === '**' ? precedence : precedence + 1;
    return wrap(
      `${this.expr(left, leftMin)} ${operator} ${this.expr(right, rightMin)}`,
      precedence,
      min,
    );
  }

  printRoot(root: Extract<Expr, { kind: 'path' }>['root']): string {
    switch (root.kind) {
      case 'state':
        if (this.mode === 'server') {
          return getLocalName(root.name);
        }
        this.usage.scope.add('model');
        return `model${getAccessor(root.name, false)}`;
      case 'props':
        if (this.mode === 'client') {
          this.usage.scope.add('props');
        }
        return 'props';
      case 'loop':
        return this.printLoop(root.name, root.index);
      case 'global':
        return root.name;
      case 'import':
        this.usage.imports.add(root.name.split('.')[0]);
        return root.name;
      case 'module':
        this.usage.modules.add(root.name);
        return root.name;
      case 'event':
        return this.fail('codegen-event', 'The event is read only as a whole event argument');
      default:
        return this.fail('codegen-unsupported', `A ${root.kind} root is not generated yet`);
    }
  }

  printLoop(name: string, index: boolean): string {
    for (let at = this.frames.length - 1; at >= 0; at--) {
      const frame = this.frames[at];
      if ((index ? frame.index : frame.item) !== name) {
        continue;
      }
      if (frame.row === undefined) {
        this.usage.vars.add(name);
        return getLocalName(name);
      }
      this.usage.scope.add('rows');
      return `rows[${frame.row}].${index ? 'index' : 'item'}`;
    }
    return this.fail('codegen-unsupported', `The loop variable ${name} is not in scope`);
  }

  printPath(expr: Extract<Expr, { kind: 'path' }>, min: number): string {
    // Props fields the client reads are copied into the state script.
    if (expr.root.kind === 'props' && this.mode === 'client') {
      const first = expr.segments.at(0);
      if (typeof first === 'string') {
        this.usage.props.add(first);
      }
    }
    let out = this.printRoot(expr.root);
    for (const segment of expr.segments) {
      if (typeof segment === 'string') {
        out += getAccessor(segment, expr.optional);
      } else if (segment.kind === 'index') {
        out += `${expr.optional ? '?.' : ''}[${this.expr(segment.value)}]`;
      } else {
        return this.fail('codegen-unsupported', `A ${segment.kind} segment is not an expression`);
      }
    }
    return wrap(out, MEMBER, min);
  }
}
