// Splits an async handler at its `await`s. The part before an `await` returns the model and a
// task. Each later part is a continuation that takes the outcome and the locals carried over.
import type { Node as AstNode, CallExpression } from '@oxc-project/types';
import { emitRange, getPropsVariable, listChildren } from './emit.ts';
import type { EmitOptions } from './emit.ts';

/** An `await` in a top-level statement of a handler, or in a statement of its `try` block. */
export interface AwaitSite {
  /** The `AwaitExpression`. */
  node: AstNode;
  /** The awaited call. */
  call: CallExpression;
  /** The index of the top-level statement that holds the `await`. */
  top: number;
  /** The index in the `try` block when that statement is a `try`, else -1. */
  inner: number;
}

export interface SplitError {
  rule: string;
  message: string;
  node: AstNode;
}

const NESTED_STATEMENTS = new Set(['BlockStatement', 'TryStatement', 'LabeledStatement']);
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
]);

/** Lists the `await`s of a node in source order, outside nested functions. */
function listAwaits(node: AstNode, into: AstNode[]): void {
  if (FUNCTION_TYPES.has(node.type)) {
    return;
  }
  if (node.type === 'AwaitExpression') {
    into.push(node);
  }
  for (const child of listChildren(node)) {
    listAwaits(child, into);
  }
}

/** Adds the site of a statement that holds at most one `await`. */
function addSite(
  statement: AstNode,
  top: number,
  inner: number,
  sites: AwaitSite[],
): SplitError | undefined {
  const found: AstNode[] = [];
  listAwaits(statement, found);
  if (found.length === 0) {
    return undefined;
  }
  if (NESTED_STATEMENTS.has(statement.type)) {
    return {
      rule: 'await-nested',
      message: `An await inside a ${statement.type} is not supported; await at the top level of the handler or in a try block`,
      node: found[0],
    };
  }
  if (found.length > 1) {
    return {
      rule: 'await-multiple',
      message: 'A statement can hold one await; put each await in a statement of its own',
      node: found[1],
    };
  }
  const node = found[0];
  if (node.type !== 'AwaitExpression' || node.argument.type !== 'CallExpression') {
    return {
      rule: 'await-callee',
      message: 'The awaited expression must be a call',
      node,
    };
  }
  sites.push({ node, call: node.argument, top, inner });
  return undefined;
}

/**
 * Finds the `await`s of a handler body and checks where they are. They may be in a top-level
 * statement, or in a statement of the block of a top-level `try` that has no `finally`.
 */
export function findAwaitSites(body: readonly AstNode[]): {
  sites: AwaitSite[];
  error: SplitError | undefined;
} {
  const sites: AwaitSite[] = [];
  for (const [top, statement] of body.entries()) {
    if (statement.type !== 'TryStatement') {
      const error = addSite(statement, top, -1, sites);
      if (error !== undefined) {
        return { sites, error };
      }
      continue;
    }
    const inHandler: AstNode[] = [];
    if (statement.handler !== null) {
      listAwaits(statement.handler, inHandler);
    }
    if (statement.finalizer !== null) {
      listAwaits(statement.finalizer, inHandler);
    }
    if (inHandler.length > 0) {
      return {
        sites,
        error: {
          rule: 'await-nested',
          message: 'An await in a catch or finally block is not supported',
          node: inHandler[0],
        },
      };
    }
    const before = sites.length;
    for (const [inner, child] of statement.block.body.entries()) {
      const error = addSite(child, top, inner, sites);
      if (error !== undefined) {
        return { sites, error };
      }
    }
    if (sites.length > before && statement.finalizer !== null) {
      return {
        sites,
        error: {
          rule: 'await-finally',
          message:
            'A try with a finally block cannot hold an await: the finally would run before the continuation',
          node: sites[before].node,
        },
      };
    }
  }
  return { sites, error: undefined };
}

export interface SplitInput {
  source: string;
  body: readonly AstNode[];
  sites: readonly AwaitSite[];
  /** The tag of each continuation, in site order: `persist$1`, `persist$2`. */
  tags: readonly string[];
  /** The locals each continuation takes, in site order, from the analysis. */
  carried: readonly (readonly string[])[];
  /** Options for `emitRange`: the props roots, `onProps`, `locals`, `returns`. */
  options: EmitOptions;
  /** The expression the model becomes, such as `{ ...model, save }`. */
  nextModel: string;
  /** What a handler returns when it ends, when it also collects `$after`: a step. */
  result?: string;
  /** The steps that start a task carry `$after` too. */
  hasAfter?: boolean;
  /** The props paths in payload order, which order the props a continuation carries. */
  propsOrder: readonly string[];
  /** Props paths that every continuation takes, such as those read by called handlers. */
  fixedProps: readonly string[];
}

export interface Continuation {
  tag: string;
  /** The names of the payload after the model: `$outcome`, the carried locals, then props. */
  params: string[];
  /** The body lines, after the lines every function of the chunk starts with. */
  lines: string[];
}

export interface Split {
  /** The body lines of the handler's first function. */
  first: string[];
  rest: Continuation[];
}

/** Orders props paths as the payload does, then the others. */
function orderProps(paths: ReadonlySet<string>, order: readonly string[]): string[] {
  const out: string[] = [];
  for (const path of order) {
    if (paths.has(path)) {
      out.push(path);
    }
  }
  for (const path of paths) {
    if (!out.includes(path)) {
      out.push(path);
    }
  }
  return out;
}

/** One pass over the handler: the body lines of each segment and the props each one read. */
function writeSegments(
  input: SplitInput,
  extraProps: readonly (readonly string[])[],
): { bodies: string[][]; used: Set<string>[] } {
  const { source, body, sites, options, nextModel } = input;
  const used: Set<string>[] = [];
  for (let index = 0; index <= sites.length; index++) {
    used.push(new Set());
  }
  let current = 0;

  /** The locals and props values a continuation takes after its outcome. */
  function listCarried(site: number): string[] {
    const names = [...input.carried[site]];
    for (const path of extraProps[site]) {
      names.push(getPropsVariable(path));
    }
    return names;
  }

  /** Writes statements as plain JavaScript. */
  function writeNodes(
    nodes: readonly AstNode[],
    indent: string,
    replacements?: ReadonlyMap<AstNode, string>,
    from?: number,
  ): string {
    const locals = [...(options.locals ?? [])];
    if (current > 0) {
      locals.push(...input.carried[current - 1]);
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    return emitRange(
      source,
      nodes,
      from ?? first.start,
      last.end,
      {
        ...options,
        locals,
        onProps(path) {
          used[current].add(path);
          options.onProps?.(path);
        },
        ...(replacements === undefined
          ? {}
          : { replacements: new Map([...(options.replacements ?? []), ...replacements]) }),
      },
      indent,
    );
  }

  /** The index of the first site at or after a top-level statement, or -1. */
  function findSite(top: number): number {
    for (const [index, site] of sites.entries()) {
      if (site.top >= top) {
        return index;
      }
    }
    return -1;
  }

  /** Returns the model and the task of a site. */
  function writeIssue(index: number, indent: string): string[] {
    const args: string[] = [];
    for (const argument of sites[index].call.arguments) {
      args.push(writeNodes([argument], ''));
    }
    const tag = input.tags[index];
    const carried = listCarried(index).join(', ');
    const task = `${indent}  task: { site: '${tag}', args: [${args.join(', ')}], then: '${tag}', carried: [${carried}] },`;
    const after = input.hasAfter === true ? [`${indent}  after: $after,`] : [];
    return [
      `${indent}return {`,
      `${indent}  $step: true,`,
      `${indent}  model: ${nextModel},`,
      task,
      ...after,
      `${indent}};`,
    ];
  }

  /** Writes the statement of a continuation that held the `await`, with its value in place. */
  function writeResumed(statement: AstNode, index: number, indent: string): string[] {
    const site = sites[index];
    if (statement.type === 'ExpressionStatement' && statement.expression === site.node) {
      return [];
    }
    return [writeNodes([statement], indent, new Map([[site.node, '$outcome.value']]))];
  }

  /** Writes a `try` whose block holds an `await`, from one statement of its block. */
  function writeRegion(top: number, from: number, resumed: number | undefined): string[] {
    const statement = body[top];
    if (statement.type !== 'TryStatement' || statement.handler === null) {
      return [];
    }
    const block = statement.block.body;
    const lines = ['  try {'];
    let start = from;
    if (resumed !== undefined) {
      lines.push('    if (!$outcome.ok) {', '      throw $outcome.error;', '    }');
      lines.push(...writeResumed(block[sites[resumed].inner], resumed, '    '));
      start = sites[resumed].inner + 1;
    }
    // The block runs up to its next `await`, or to its end.
    let next = -1;
    for (const [index, site] of sites.entries()) {
      if (site.top === top && site.inner >= start && (resumed === undefined || index > resumed)) {
        next = index;
        break;
      }
    }
    const stop = next === -1 ? block.length : sites[next].inner;
    if (stop > start) {
      lines.push(writeNodes(block.slice(start, stop), '    '));
    }
    if (next !== -1) {
      lines.push(...writeIssue(next, '    '));
    }
    // From the `}` of the block, so the catch clause keeps its indentation.
    lines.push(writeNodes([statement.handler], '  ', undefined, statement.block.end - 1));
    lines.push(...writeFlow(top + 1));
    return lines;
  }

  /** Writes the top-level statements from one on, up to the next `await` or the end. */
  function writeFlow(from: number): string[] {
    const index = findSite(from);
    const stop = index === -1 ? body.length : sites[index].top;
    const lines: string[] = [];
    if (stop > from) {
      lines.push(writeNodes(body.slice(from, stop), '  '));
    }
    if (index === -1) {
      if (body.at(-1)?.type !== 'ReturnStatement') {
        lines.push(`  return ${input.result ?? nextModel};`);
      }
    } else if (body[stop].type === 'TryStatement') {
      lines.push(...writeRegion(stop, 0, undefined));
    } else {
      lines.push(...writeIssue(index, '  '));
    }
    return lines;
  }

  const bodies: string[][] = [writeFlow(0)];
  for (const [index, site] of sites.entries()) {
    current = index + 1;
    if (site.inner !== -1) {
      bodies.push(writeRegion(site.top, 0, index));
      continue;
    }
    const lines = ['  if (!$outcome.ok) {', '    throw $outcome.error;', '  }'];
    lines.push(...writeResumed(body[site.top], index, '  '));
    lines.push(...writeFlow(site.top + 1));
    bodies.push(lines);
  }
  return { bodies, used };
}

/**
 * Splits a handler into the function of its first part and one continuation per `await`.
 * A continuation also takes the props values that it or a later one reads, after the locals,
 * since only the first part has the props of the render.
 */
export function splitSegments(input: SplitInput): Split {
  const empty: string[][] = [];
  for (let index = 0; index < input.sites.length; index++) {
    empty.push([]);
  }
  // The first pass finds which props each part reads.
  const scan = writeSegments(input, empty);
  const extra: string[][] = [];
  for (let index = 0; index < input.sites.length; index++) {
    const paths = new Set<string>(input.fixedProps);
    for (let later = index + 1; later < scan.used.length; later++) {
      for (const path of scan.used[later]) {
        paths.add(path);
      }
    }
    extra.push(orderProps(paths, input.propsOrder));
  }
  const final = writeSegments(input, extra);
  const rest: Continuation[] = [];
  for (let index = 0; index < input.sites.length; index++) {
    const params = ['$outcome', ...input.carried[index]];
    for (const path of extra[index]) {
      params.push(getPropsVariable(path));
    }
    rest.push({ tag: input.tags[index], params, lines: final.bodies[index + 1] });
  }
  return { first: final.bodies[0], rest };
}
