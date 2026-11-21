/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// A stand-in for the compiler. It finds the handlers of a module with
// oxc-parser and takes the binding groups from a hand-written table, since
// view analysis is the job of `spike-view-analysis`. Only the chunk split is
// under test here.
import { parseSync } from 'oxc-parser';

export interface CompiledModule {
  /** Chunk source by handler name. */
  handlers: Map<string, string>;
  /** Chunk source by binding group key, a model path such as `todos.*.done`. */
  bindings: Map<string, string>;
  /** Source of the module-level helpers, for `helpers: 'import'`. */
  helpers: string;
  /** Source of the server renderer. */
  server: string;
}

export type HelperMode = 'inline' | 'import';

/**
 * The holes of the todo fixture by binding group. A hole that reads two
 * groups, such as `left`, is in both.
 */
const FIXTURE_BINDINGS: Record<string, string[]> = {
  draft: [
    "setProperty(nodes[0], 'value', draft)",
    "setProperty(nodes[1], 'disabled', draft === '')",
  ],
  'save.state': ["setProperty(nodes[2], 'disabled', save.state === 'saving')"],
  todos: ['setText(nodes[3], left)', 'nodes[4].replaceChildren(...todos.map(String))'],
  'todos.*.done': [
    'setText(nodes[3], left)',
    "row.classList.toggle('done', item.done)",
    "setProperty(row.firstChild, 'checked', item.done)",
  ],
  'todos.*.text': ['setText(row.lastChild, item.text)'],
};

interface Span {
  start: number;
  end: number;
}

function indentLines(lines: string[], end = ''): string[] {
  const result: string[] = [];
  for (const line of lines) {
    result.push(`  ${line}${end}`);
  }
  return result;
}

function exportAll(declarations: string[]): string[] {
  const result: string[] = [];
  for (const declaration of declarations) {
    result.push(`export ${declaration}`);
  }
  return result;
}

function sliceSpan(code: string, node: Span): string {
  return code.slice(node.start, node.end);
}

export function compileModule(
  file: string,
  code: string,
  helperImport: string,
  mode: HelperMode,
): CompiledModule {
  const { program, errors } = parseSync(file, code);
  if (errors.length > 0) {
    throw new Error(`${file}: ${errors[0]!.message}`);
  }
  // Split the top level into imports, helpers and the component.
  const imports: string[] = [];
  const helpers: string[] = [];
  let component: any;
  for (const statement of program.body as any[]) {
    if (statement.type === 'ImportDeclaration') {
      imports.push(sliceSpan(code, statement));
    } else if (statement.type === 'FunctionDeclaration') {
      helpers.push(sliceSpan(code, statement));
    } else if (statement.type === 'ExportDefaultDeclaration') {
      component = statement.declaration;
    }
  }
  if (component?.type !== 'FunctionDeclaration') {
    throw new Error(`${file}: no default export function`);
  }
  // Split the body into state, derived values and handlers.
  const state: string[] = [];
  const derived: string[] = [];
  const handlers = new Map<string, string>();
  for (const statement of component.body.body as any[]) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (statement.kind === 'let') {
          state.push(declarator.id.name);
        } else {
          derived.push(sliceSpan(code, statement));
        }
      }
    } else if (statement.type === 'FunctionDeclaration') {
      handlers.set(statement.id.name, sliceSpan(code, statement));
    }
  }
  // Each chunk gets the helpers as a copy or as an import of one shared module.
  const helperNames: string[] = [];
  for (const helper of helpers) {
    const match = /function\s+([\w$]+)/.exec(helper);
    helperNames.push(match![1]!);
  }
  const prelude =
    mode === 'inline'
      ? [...imports, ...helpers]
      : [...imports, `import { ${helperNames.join(', ')} } from ${JSON.stringify(helperImport)};`];
  const locals = `let { ${state.join(', ')} } = model;`;

  // A handler chunk runs the handler over locals and returns the next model.
  const handlerChunks = new Map<string, string>();
  for (const [name, source] of handlers) {
    handlerChunks.set(
      name,
      [
        ...prelude,
        'export function update(model, payload) {',
        `  ${locals}`,
        ...indentLines(derived),
        `  ${source}`,
        `  const result = ${name}(...payload);`,
        `  const next = () => ({ ${state.join(', ')} });`,
        '  return result instanceof Promise ? result.then(next) : next();',
        '}',
      ].join('\n'),
    );
  }
  // A binding chunk patches the holes that read its group.
  const bindingChunks = new Map<string, string>();
  for (const [key, holes] of Object.entries(FIXTURE_BINDINGS)) {
    bindingChunks.set(
      key,
      [
        ...prelude,
        "import { setText, setProperty } from 'idlip';",
        'export function patch(model, nodes, row, item) {',
        `  ${locals}`,
        ...indentLines(derived),
        ...indentLines(holes, ';'),
        '}',
      ].join('\n'),
    );
  }
  return {
    handlers: handlerChunks,
    bindings: bindingChunks,
    helpers: [...imports, ...exportAll(helpers)].join('\n'),
    server: [
      ...imports,
      ...helpers,
      'export function renderModel(model) {',
      `  ${locals}`,
      ...indentLines(derived),
      '  return `<p>${left} left</p>`;',
      '}',
    ].join('\n'),
  };
}
