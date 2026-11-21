import type { Node as AstNode, CallExpression } from '@oxc-project/types';
import { listChildren } from './emit.ts';

// Awaited calls of a handler: which are built in, and the code of the tasks that run them.

/** The module that exports `Random` and `Time`. */
const STOCK_MODULE = 'idlip';

/** Built-in sites by callee text, each with the body of its `task$<site>` function. */
const BUILTINS = new Map<string, { params: string; body: string[] }>([
  ['Random.id', { params: '', body: ['return crypto.randomUUID();'] }],
  ['Random.number', { params: '', body: ['return Math.random();'] }],
  ['Time.now', { params: '', body: ['return Date.now();'] }],
  [
    'Dom.measure',
    {
      params: 'ref',
      body: [
        "const name = typeof ref === 'string' ? ref : `${ref[0]} ${ref[1]}`;",
        "for (const node of (this ?? document).querySelectorAll('[i-ref]')) {",
        "  if (node.getAttribute('i-ref') === name) {",
        '    const { x, y, width, height } = node.getBoundingClientRect();',
        '    return { x, y, width, height };',
        '  }',
        '}',
        'console.warn(`idlip: no ref ${name}`);',
        'return null;',
      ],
    },
  ],
  [
    'Time.sleep',
    {
      params: 'ms, signal',
      body: [
        'return new Promise((resolve, reject) => {',
        '  const timer = setTimeout(resolve, ms);',
        "  signal?.addEventListener('abort', () => {",
        '    clearTimeout(timer);',
        '    reject(signal.reason);',
        '  });',
        '});',
      ],
    },
  ],
]);

/** Tells whether a callee is a built-in site: its text, such as `Random.id`, and its import. */
export function isBuiltinTask(callee: string, source: string | undefined): boolean {
  return source === STOCK_MODULE && BUILTINS.has(callee);
}

/** The chunk that runs a site. A built-in runs from the handler's own chunk. */
export function getTaskChunk(handler: string, site: string, builtin: boolean): string {
  return builtin ? `handler=${handler}` : `task=${site}`;
}

/** Writes `task$<site>`, the copy of a built-in in the handler chunk. */
export function emitBuiltinTask(site: string, callee: string): string[] {
  const builtin = BUILTINS.get(callee);
  if (builtin === undefined) {
    return [];
  }
  const lines = [`export function task$${site}(${builtin.params}) {`];
  for (const line of builtin.body) {
    lines.push(`  ${line}`);
  }
  lines.push('}');
  return lines;
}

/** Writes the part of a task chunk after its imports and helpers. */
export function emitTaskRun(callee: string): string[] {
  return ['export function run(...args) {', `  return ${callee}(...args);`, '}'];
}

const DOM_CALLS = new Set(['focus', 'scrollIntoView', 'reset']);

/** What `findDomCalls` found in the functions of a handler. */
export interface DomCalls {
  /** Each `Dom.focus(...)` statement to the `$after.push(...)` that replaces it. */
  replacements: Map<AstNode, string>;
  /** A `Dom` call that is not a statement of its own. */
  error: AstNode | undefined;
}

function isDomCall(node: AstNode, local: string): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === local &&
    node.callee.property.type === 'Identifier' &&
    DOM_CALLS.has(node.callee.property.name)
  );
}

/**
 * Finds the plain `Dom.focus`, `Dom.scrollIntoView` and `Dom.reset` statements under the nodes.
 * `write` prints an argument. Each statement becomes a push to `$after`, which the loader runs
 * after the patch. A call in another position is an error, since its value would not exist.
 */
export function findDomCalls(
  nodes: readonly AstNode[],
  local: string,
  write: (argument: AstNode) => string,
): DomCalls {
  const found: DomCalls = { replacements: new Map(), error: undefined };
  function visit(node: AstNode, parent: AstNode | undefined): void {
    if (isDomCall(node, local)) {
      if (parent?.type === 'ExpressionStatement' && node.arguments.length === 1) {
        const name = String(Reflect.get(Reflect.get(node.callee, 'property'), 'name'));
        found.replacements.set(
          parent,
          `$after.push({ call: '${name}', args: [${write(node.arguments[0])}] });`,
        );
      } else {
        found.error ??= node;
      }
      return;
    }
    for (const child of listChildren(node)) {
      visit(child, node);
    }
  }
  for (const node of nodes) {
    visit(node, undefined);
  }
  return found;
}
