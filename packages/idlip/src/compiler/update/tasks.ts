// Awaited calls of a handler: which are built in, and the code of the tasks that run them.

/** The module that exports `Random` and `Time`. */
const STOCK_MODULE = 'idlip';

/** Built-in sites by callee text, each with the body of its `task$<site>` function. */
const BUILTINS = new Map<string, { params: string; body: string[] }>([
  ['Random.id', { params: '', body: ['return crypto.randomUUID();'] }],
  ['Random.number', { params: '', body: ['return Math.random();'] }],
  ['Time.now', { params: '', body: ['return Date.now();'] }],
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
