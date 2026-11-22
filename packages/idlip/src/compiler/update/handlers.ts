// Compiles each handler of a component into a client module: an update function over the model.
import { parseSync } from 'oxc-parser';
import type { Node as AstNode, Function as FunctionNode, Program } from '@oxc-project/types';
import type { CompileDiagnostic, Module } from '../../core/format.ts';
import { analyze } from '../view/analyze/index.ts';
import type { Component, Handler, ModuleIR, Path } from '../view/analyze/index.ts';
import {
  emitRange,
  getPropsVariable,
  listPatternNames,
  listReferences,
  scanReferences,
} from './emit.ts';
import type { EmitOptions, PropsRoots } from './emit.ts';
import { findAwaitSites, splitSegments } from './segments.ts';
import type { AwaitSite } from './segments.ts';
import {
  emitBuiltinTask,
  emitTaskRun,
  findDomCalls,
  getTaskChunk,
  isBuiltinTask,
} from './tasks.ts';

export interface CompileHandlersResult {
  /** One module per handler, `handler=<tag>`. Empty when a diagnostic is an error. */
  client: Module[];
  diagnostics: CompileDiagnostic[];
  /** True when a handler calls `Dom` after the patch, so the manifest says `after`. */
  after?: true;
}

/** Where a module-level name is declared, and the statement to copy. */
interface ModuleBinding {
  statement: AstNode;
  /** The node to copy: the declaration without its `export`. */
  declaration: AstNode;
}

interface ImportBinding {
  /** The `import` statement. */
  statement: AstNode;
  /** The local names this statement binds, by name. */
  specifier: AstNode;
}

/** The parts of a source a handler can reach. */
interface Scope {
  source: string;
  component: Component;
  handlers: Map<string, FunctionNode>;
  derived: Map<string, { declaration: AstNode; init: AstNode }>;
  modules: Map<string, ModuleBinding>;
  imports: Map<string, ImportBinding>;
  roots: PropsRoots;
}

/** Joins the segments of a props path. Segments of a props path are field names. */
function printPropsPath(path: Path): string {
  const names: string[] = [];
  for (const segment of path.segments) {
    if (typeof segment === 'string') {
      names.push(segment);
    }
  }
  return names.join('.');
}

/**
 * Lists the props values a handler needs: the paths it reads, then those of the handlers it
 * calls. They come first in the payload, before the handler's arguments, so a rest parameter
 * stays last. `compile-view-codegen` writes the same list into the event payload.
 */
export function listHandlerProps(component: Component, handler: Handler): string[] {
  const byName = new Map<string, Handler>();
  for (const candidate of component.handlers) {
    byName.set(candidate.name, candidate);
  }
  const paths: string[] = [];
  for (const item of listClosure(byName, handler)) {
    for (const entry of item.free) {
      if (entry.kind !== 'props') {
        continue;
      }
      for (const path of entry.paths) {
        const text = printPropsPath(path);
        if (!paths.includes(text)) {
          paths.push(text);
        }
      }
    }
  }
  return paths;
}

/** The handler and every handler it calls, directly or not, in discovery order. */
function listClosure(byName: ReadonlyMap<string, Handler>, handler: Handler): Handler[] {
  const out: Handler[] = [handler];
  for (let index = 0; index < out.length; index++) {
    for (const entry of out[index].free) {
      const callee = entry.kind === 'handler' ? byName.get(entry.name) : undefined;
      if (callee !== undefined && !out.includes(callee)) {
        out.push(callee);
      }
    }
  }
  return out;
}

function unwrapExport(statement: AstNode): AstNode {
  if (
    (statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration') &&
    statement.declaration !== null
  ) {
    return statement.declaration;
  }
  return statement;
}

function listDeclaredNames(declaration: AstNode): string[] {
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
    return declaration.id === null ? [] : [declaration.id.name];
  }
  if (declaration.type === 'VariableDeclaration') {
    const names: string[] = [];
    for (const declarator of declaration.declarations) {
      listPatternNames(declarator.id, names);
    }
    return names;
  }
  return [];
}

/** The root component: the first exported stateful one, else the first stateful one. */
export function pickComponent(ir: ModuleIR): Component | undefined {
  for (const component of ir.components) {
    if (component.exported && component.mode === 'stateful') {
      return component;
    }
  }
  for (const component of ir.components) {
    if (component.mode === 'stateful') {
      return component;
    }
  }
  return undefined;
}

function readPropsRoots(component: Component): Map<string, string[]> {
  const roots = new Map<string, string[]>();
  if (component.props.kind === 'param') {
    roots.set(component.props.name, []);
  } else if (component.props.kind === 'pattern') {
    for (const field of component.props.fields) {
      roots.set(field.local, [field.key]);
    }
  }
  return roots;
}

/** Reads what the component's body and the module declare. */
function readScope(program: Program, source: string, component: Component): Scope | undefined {
  const scope: Scope = {
    source,
    component,
    handlers: new Map(),
    derived: new Map(),
    modules: new Map(),
    imports: new Map(),
    roots: readPropsRoots(component),
  };
  let body: AstNode[] | undefined;
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      if (statement.importKind === 'type') {
        continue;
      }
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
          continue;
        }
        scope.imports.set(specifier.local.name, { statement, specifier });
      }
      continue;
    }
    const declaration = unwrapExport(statement);
    if (declaration.type === 'FunctionDeclaration' && declaration.id?.name === component.name) {
      body = declaration.body?.body;
      continue;
    }
    for (const name of listDeclaredNames(declaration)) {
      scope.modules.set(name, { statement, declaration });
    }
  }
  if (body === undefined) {
    return undefined;
  }
  for (const statement of body) {
    if (statement.type === 'FunctionDeclaration' && statement.id !== null) {
      scope.handlers.set(statement.id.name, statement);
    } else if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.init !== null) {
          scope.derived.set(declarator.id.name, { declaration: statement, init: declarator.init });
        }
      }
    }
  }
  return scope;
}

/** A diagnostic for a handler. */
function makeDiagnostic(
  rule: string,
  severity: 'error' | 'warning',
  message: string,
  handler: Handler,
): CompileDiagnostic {
  return { rule, severity, message, span: handler.span };
}

/** Lists the state fields a derived value depends on, through other derived values too. */
function listStateDeps(scope: Scope, name: string): string[] {
  const fields = new Set<string>();
  for (const field of scope.component.state) {
    fields.add(field.name);
  }
  const out: string[] = [];
  const queue = [name];
  const seen = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const found = scope.derived.get(queue[index]);
    if (found === undefined || seen.has(queue[index])) {
      continue;
    }
    seen.add(queue[index]);
    for (const ref of scanReferences(found.init)) {
      if (scope.derived.has(ref.name)) {
        queue.push(ref.name);
      } else if (fields.has(ref.name)) {
        out.push(ref.name);
      }
    }
  }
  return out;
}

/** Warns when `item` reads a derived value after it wrote a field the value depends on. */
function warnStale(
  scope: Scope,
  byName: ReadonlyMap<string, Handler>,
  item: Handler,
  derivedNames: readonly string[],
  handler: Handler,
  diagnostics: CompileDiagnostic[],
): void {
  const fn = scope.handlers.get(item.name);
  if (fn?.body === null || fn === undefined) {
    return;
  }
  const params: string[] = [];
  for (const param of fn.params) {
    listPatternNames(param, params);
  }
  const writtenSoFar = new Set<string>();
  const warned = new Set<string>();
  for (const ref of scanReferences(fn.body, params)) {
    const callee = byName.get(ref.name);
    if (ref.write) {
      writtenSoFar.add(ref.name);
    } else if (callee !== undefined) {
      for (const inner of listClosure(byName, callee)) {
        for (const name of inner.writes) {
          writtenSoFar.add(name);
        }
      }
    } else if (derivedNames.includes(ref.name) && !warned.has(ref.name)) {
      let stale: string | undefined;
      for (const dep of listStateDeps(scope, ref.name)) {
        if (writtenSoFar.has(dep)) {
          stale = dep;
        }
      }
      if (stale !== undefined) {
        warned.add(ref.name);
        diagnostics.push(
          makeDiagnostic(
            'handler-derived-stale',
            'warning',
            `${item.name} reads ${ref.name} after it writes ${stale}, but ${ref.name} is computed before the write`,
            handler,
          ),
        );
      }
    }
  }
}

/** Adds every name a node refers to, except those inside the skipped nodes. */
function listReferencesOutside(node: AstNode, skip: readonly AstNode[], into: Set<string>): void {
  for (const reference of scanReferences(node)) {
    let inside = false;
    for (const range of skip) {
      if (reference.start >= range.start && reference.start < range.end) {
        inside = true;
      }
    }
    if (!inside) {
      into.add(reference.name);
    }
  }
}

/** Finds the module-level helpers that some names reach, transitively, in source order. */
function collectHelpers(
  scope: Scope,
  seeds: Iterable<string>,
  handler: Handler,
  diagnostics: CompileDiagnostic[],
): { statements: ModuleBinding[]; queue: string[] } | undefined {
  const helperNames: string[] = [];
  const queue = [...seeds];
  for (let index = 0; index < queue.length; index++) {
    const binding = scope.modules.get(queue[index]);
    if (binding === undefined || helperNames.includes(queue[index])) {
      continue;
    }
    helperNames.push(queue[index]);
    const inner = new Set<string>();
    listReferences(binding.declaration, inner);
    queue.push(...inner);
  }
  const statements: ModuleBinding[] = [];
  for (const binding of scope.modules.values()) {
    for (const name of helperNames) {
      if (scope.modules.get(name) === binding && !statements.includes(binding)) {
        statements.push(binding);
      }
    }
  }
  statements.sort((a, b) => a.statement.start - b.statement.start);
  // Each chunk has its own copy of a helper, so a helper cannot keep state in a module `let`.
  for (const binding of statements) {
    for (const ref of scanReferences(binding.declaration)) {
      const target = ref.write ? scope.modules.get(ref.name) : undefined;
      if (
        target?.declaration.type === 'VariableDeclaration' &&
        target.declaration.kind !== 'const'
      ) {
        diagnostics.push(
          makeDiagnostic(
            'helper-module-state',
            'error',
            `A helper of ${handler.name} assigns the module-level ${ref.name}; keep it in state`,
            handler,
          ),
        );
        return undefined;
      }
    }
  }
  return { statements, queue };
}

/** The local name of `Dom` imported from `idlip`, if any. */
function findDomLocal(scope: Scope): string | undefined {
  for (const [name, binding] of scope.imports) {
    const { statement, specifier } = binding;
    if (
      statement.type === 'ImportDeclaration' &&
      statement.source.value === 'idlip' &&
      specifier.type === 'ImportSpecifier' &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === 'Dom'
    ) {
      return name;
    }
  }
  return undefined;
}

/** An awaited call of a handler, ready for its task. */
interface AwaitedCall {
  site: AwaitSite;
  tag: string;
  /** The callee as written, such as `saveTodos` or `api.load`. */
  callee: string;
  /** The name the callee starts with. */
  root: string;
  builtin: boolean;
}

interface Awaited {
  calls: AwaitedCall[];
  /** The callee nodes, which the handler chunk does not need to import. */
  callees: AstNode[];
  roots: Set<string>;
}

/** Reads the callee of each `await`. Reports a callee that is not an import or a module function. */
function readAwaited(
  scope: Scope,
  sites: readonly AwaitSite[],
  handler: Handler,
  diagnostics: CompileDiagnostic[],
): Awaited | undefined {
  const out: Awaited = { calls: [], callees: [], roots: new Set() };
  for (const [index, site] of sites.entries()) {
    const callee = site.call.callee;
    let root: AstNode = callee;
    while (root.type === 'MemberExpression') {
      root = root.object;
    }
    if (root.type !== 'Identifier') {
      diagnostics.push(
        makeDiagnostic(
          'await-callee',
          'error',
          'The awaited callee must be an import or a module-level function',
          handler,
        ),
      );
      return undefined;
    }
    const binding = scope.imports.get(root.name);
    const source =
      binding?.statement.type === 'ImportDeclaration' ? binding.statement.source.value : undefined;
    if (binding === undefined && !scope.modules.has(root.name)) {
      diagnostics.push(
        makeDiagnostic(
          'await-callee',
          'error',
          'The awaited callee must be an import or a module-level function',
          handler,
        ),
      );
      return undefined;
    }
    const text = scope.source.slice(callee.start, callee.end);
    out.calls.push({
      site,
      tag: handler.segments[index + 1].tag,
      callee: text,
      root: root.name,
      builtin: isBuiltinTask(text, source),
    });
    out.callees.push(callee);
    out.roots.add(root.name);
  }
  return out;
}

/** Compiles the chunk of an awaited call that is not built in: it exports `run`. */
function compileTask(
  scope: Scope,
  handler: Handler,
  call: AwaitedCall,
  diagnostics: CompileDiagnostic[],
): Module | undefined {
  const found = collectHelpers(scope, [call.root], handler, diagnostics);
  if (found === undefined) {
    return undefined;
  }
  const used = new Set<string>(found.queue);
  for (const binding of found.statements) {
    listReferences(binding.declaration, used);
  }
  const lines: string[] = [];
  const importLines = emitImports(scope, used);
  lines.push(...importLines);
  if (importLines.length > 0) {
    lines.push('');
  }
  for (const binding of found.statements) {
    lines.push(
      emitRange(
        scope.source,
        [binding.declaration],
        binding.declaration.start,
        binding.declaration.end,
        {},
        '',
      ),
    );
  }
  if (found.statements.length > 0) {
    lines.push('');
  }
  lines.push(...emitTaskRun(call.callee));
  return { chunk: getTaskChunk(handler.name, call.tag, false), code: `${lines.join('\n')}\n` };
}

/** Compiles one handler. Returns its code, or undefined with the diagnostics added. */
function compileHandler(
  scope: Scope,
  handler: Handler,
  diagnostics: CompileDiagnostic[],
): { code: string; tasks: Module[]; after: boolean } | undefined {
  const { component, source } = scope;
  const byName = new Map<string, Handler>();
  for (const candidate of component.handlers) {
    byName.set(candidate.name, candidate);
  }
  const closure = listClosure(byName, handler);
  for (const item of closure.slice(1)) {
    if (item.segments.length > 1) {
      diagnostics.push(
        makeDiagnostic(
          'await-handler',
          'error',
          `${handler.name} calls ${item.name}, which awaits; only the handler of the message can await`,
          handler,
        ),
      );
      return undefined;
    }
  }
  const entry = scope.handlers.get(handler.name);
  const entryBody = entry?.body;
  if (entry === undefined || !entryBody) {
    return undefined;
  }
  const split = findAwaitSites(entryBody.body);
  if (split.error !== undefined) {
    const { rule, message, node } = split.error;
    diagnostics.push({
      rule,
      severity: 'error',
      message,
      span: { start: node.start, end: node.end },
    });
    return undefined;
  }
  const sites = split.sites;
  if (sites.length !== handler.segments.length - 1) {
    diagnostics.push(
      makeDiagnostic(
        'await-nested',
        'error',
        `${handler.name} awaits somewhere the compiler cannot split`,
        handler,
      ),
    );
    return undefined;
  }
  const awaited = readAwaited(scope, sites, handler, diagnostics);
  if (awaited === undefined) {
    return undefined;
  }

  // What the closure reads: state, derived values, helpers and imports.
  const stateNames = new Set<string>();
  const derivedNames: string[] = [];
  const references = new Set<string>();
  for (const item of closure) {
    for (const name of item.writes) {
      stateNames.add(name);
    }
    for (const usage of item.free) {
      if (usage.kind === 'state') {
        stateNames.add(usage.name);
      } else if (usage.kind === 'derived') {
        if (!derivedNames.includes(usage.name)) {
          derivedNames.push(usage.name);
        }
      } else if (
        (usage.kind === 'module' || usage.kind === 'import') &&
        !awaited.roots.has(usage.name)
      ) {
        references.add(usage.name);
      }
    }
  }
  // A name that only an awaited call uses belongs to the task chunk. Others stay here.
  if (awaited.roots.size > 0) {
    const outside = new Set<string>();
    for (const item of closure) {
      const fn = scope.handlers.get(item.name);
      if (fn !== undefined) {
        listReferencesOutside(fn, awaited.callees, outside);
      }
    }
    for (const name of outside) {
      if (awaited.roots.has(name) && (scope.modules.has(name) || scope.imports.has(name))) {
        references.add(name);
      }
    }
  }
  // `Dom` calls become entries of `$after`, so the chunk does not import `Dom`.
  const domLocal = findDomLocal(scope);
  if (domLocal !== undefined) {
    references.delete(domLocal);
  }
  // A derived value reads state, other derived values, helpers and imports.
  const derivedDeps = new Map<string, Set<string>>();
  for (let index = 0; index < derivedNames.length; index++) {
    const found = scope.derived.get(derivedNames[index]);
    if (found === undefined) {
      continue;
    }
    const names = new Set<string>();
    listReferences(found.init, names);
    derivedDeps.set(derivedNames[index], names);
    for (const name of names) {
      if (scope.derived.has(name) && !derivedNames.includes(name)) {
        derivedNames.push(name);
      }
      if (scope.roots.has(name)) {
        diagnostics.push(
          makeDiagnostic(
            'handler-derived-props',
            'error',
            `${handler.name} reads ${derivedNames[index]}, which reads props; read the prop in the handler instead`,
            handler,
          ),
        );
        return undefined;
      }
    }
  }
  const stateOrder: string[] = [];
  for (const field of component.state) {
    stateOrder.push(field.name);
  }
  for (const names of derivedDeps.values()) {
    for (const name of names) {
      if (stateOrder.includes(name)) {
        stateNames.add(name);
      }
      references.add(name);
    }
  }
  const written = new Set<string>();
  for (const item of closure) {
    for (const name of item.writes) {
      written.add(name);
    }
  }
  // A derived value is computed once, from the model the handler starts with.
  for (const item of closure) {
    warnStale(scope, byName, item, derivedNames, handler, diagnostics);
  }

  // Module-level helpers, transitively, then the imports the code uses.
  const helpers = collectHelpers(scope, references, handler, diagnostics);
  if (helpers === undefined) {
    return undefined;
  }
  const { statements: helperStatements, queue } = helpers;
  const used = new Set<string>(queue);
  for (const binding of helperStatements) {
    listReferences(binding.declaration, used);
  }
  for (const item of closure) {
    const fn = scope.handlers.get(item.name);
    if (fn !== undefined) {
      listReferencesOutside(fn, awaited.callees, used);
    }
  }
  if (domLocal !== undefined) {
    used.delete(domLocal);
  }

  // The payload: the props values of the closure, then the handler's arguments.
  const propsPaths = listHandlerProps(component, handler);
  const unlisted: string[] = [];
  function onProps(path: string): void {
    if (!propsPaths.includes(path) && !unlisted.includes(path)) {
      unlisted.push(path);
    }
  }

  const lines: string[] = [];
  const importLines = emitImports(scope, used);
  lines.push(...importLines);
  if (importLines.length > 0) {
    lines.push('');
  }
  for (const binding of helperStatements) {
    lines.push(
      emitRange(
        source,
        [binding.declaration],
        binding.declaration.start,
        binding.declaration.end,
        {},
        '',
      ),
    );
  }
  if (helperStatements.length > 0) {
    lines.push('');
  }

  // The body first, so the props it reads are known when the signature is written.
  const out: string[] = [];
  const names: string[] = [];
  for (const name of stateOrder) {
    if (stateNames.has(name)) {
      names.push(name);
    }
  }
  const writtenNames: string[] = [];
  for (const name of stateOrder) {
    if (written.has(name)) {
      writtenNames.push(name);
    }
  }
  const nextModel =
    writtenNames.length === 0 ? 'model' : `{ ...model, ${writtenNames.join(', ')} }`;
  if (names.length > 0) {
    out.push(`  let { ${names.join(', ')} } = model;`);
  }
  const derivedSorted = [...derivedNames].sort(
    (a, b) =>
      (scope.derived.get(a)?.declaration.start ?? 0) -
      (scope.derived.get(b)?.declaration.start ?? 0),
  );
  for (const name of derivedSorted) {
    const found = scope.derived.get(name);
    if (found !== undefined) {
      const text = emitRange(source, [found.init], found.init.start, found.init.end, {}, '');
      out.push(`  const ${name} = ${text};`);
    }
  }
  // A handler that calls itself is nested too, so the call reaches the nested function.
  let recursive = false;
  for (const item of closure) {
    for (const free of item.free) {
      if (free.kind === 'handler' && free.name === handler.name) {
        recursive = true;
      }
    }
  }
  const entryParams: string[] = [];
  for (const param of entry.params) {
    listPatternNames(param, entryParams);
  }
  if (recursive && sites.length > 0) {
    diagnostics.push(
      makeDiagnostic(
        'await-handler',
        'error',
        `${handler.name} awaits and calls itself; a recursive handler cannot await`,
        handler,
      ),
    );
    return undefined;
  }
  // The props that called handlers read ride in every continuation, as they are in every function.
  const nestedProps: string[] = [];
  const options: EmitOptions = {
    props: scope.roots,
    onProps(path: string): void {
      onProps(path);
      if (!nestedProps.includes(path)) {
        nestedProps.push(path);
      }
    },
  };
  // Plain `Dom` calls of the closure run after the patch: each pushes to `$after`.
  let hasAfter = false;
  if (domLocal !== undefined) {
    const functions: AstNode[] = [];
    for (const item of closure) {
      const fn = scope.handlers.get(item.name);
      if (fn !== undefined) {
        functions.push(fn);
      }
    }
    const calls = findDomCalls(functions, domLocal, (argument) =>
      emitRange(
        source,
        [argument],
        argument.start,
        argument.end,
        { ...options, locals: entryParams },
        '',
      ),
    );
    if (calls.error !== undefined) {
      diagnostics.push({
        rule: 'dom-call-position',
        severity: 'error',
        message: 'Call Dom.focus, Dom.scrollIntoView and Dom.reset as a statement of their own',
        span: { start: calls.error.start, end: calls.error.end },
      });
      return undefined;
    }
    hasAfter = calls.replacements.size > 0;
    options.replacements = calls.replacements;
  }
  const result = hasAfter ? `{ $step: true, model: ${nextModel}, after: $after }` : nextModel;
  if (hasAfter) {
    out.push('  const $after = [];');
  }
  for (const item of recursive ? closure : closure.slice(1)) {
    const fn = scope.handlers.get(item.name);
    if (fn !== undefined) {
      out.push(emitRange(source, [fn], fn.start, fn.end, options, '  '));
    }
  }
  options.onProps = onProps;
  const head = [...out];
  const statements = entryBody.body;
  const continuations: { tag: string; params: string[]; lines: string[] }[] = [];
  if (sites.length > 0) {
    const finallyReturns: number[] = [];
    const tags: string[] = [];
    const carried: string[][] = [];
    for (const part of handler.segments.slice(1)) {
      tags.push(part.tag);
      carried.push(part.carried);
    }
    const parts = splitSegments({
      source,
      body: statements,
      sites,
      tags,
      carried,
      options: {
        ...options,
        locals: entryParams,
        returns: `return ${result};`,
        onFinallyReturn: (start: number): void => {
          finallyReturns.push(start);
        },
      },
      nextModel,
      result,
      hasAfter,
      propsOrder: propsPaths,
      fixedProps: nestedProps,
    });
    if (finallyReturns.length > 0) {
      diagnostics.push(
        makeDiagnostic(
          'handler-return-finally',
          'error',
          `${handler.name} returns inside a try block that has a finally; the finally block's writes would be lost`,
          handler,
        ),
      );
      return undefined;
    }
    out.push(...parts.first);
    continuations.push(...parts.rest);
  } else if (recursive) {
    out.push(`  ${handler.name}(...$args);`);
    out.push(`  return ${result};`);
  } else {
    const finallyReturns: number[] = [];
    const inline = {
      ...options,
      locals: entryParams,
      returns: `return ${result};`,
      onFinallyReturn: (start: number): void => {
        finallyReturns.push(start);
      },
    };
    if (statements.length > 0) {
      const first = statements[0];
      const last = statements[statements.length - 1];
      out.push(emitRange(source, statements, first.start, last.end, inline, '  '));
    }
    if (finallyReturns.length > 0) {
      diagnostics.push(
        makeDiagnostic(
          'handler-return-finally',
          'error',
          `${handler.name} returns inside a try block that has a finally; the finally block's writes would be lost`,
          handler,
        ),
      );
      return undefined;
    }
    if (statements.at(-1)?.type !== 'ReturnStatement') {
      out.push(`  return ${result};`);
    }
  }

  // The event payload holds the listed props only, so an unlisted one would shift the arguments.
  if (unlisted.length > 0) {
    diagnostics.push(
      makeDiagnostic(
        'handler-props-unlisted',
        'error',
        `${handler.name} reads the props path ${unlisted.join(', ')} that the analysis did not list; the event payload would not carry it`,
        handler,
      ),
    );
    return undefined;
  }

  // The parameters: one variable per props path, then the handler's own.
  const params: string[] = [];
  for (const path of propsPaths) {
    params.push(getPropsVariable(path));
  }
  if (recursive) {
    params.push('...$args');
  } else {
    for (const param of entry.params) {
      params.push(emitRange(source, [param], param.start, param.end, {}, ''));
    }
  }
  const payload = params.length === 0 ? '' : `, [${params.join(', ')}]`;
  lines.push(`export function ${handler.name}(model${payload}) {`);
  lines.push(...out);
  lines.push('}');
  for (const part of continuations) {
    lines.push('', `export function ${part.tag}(model, [${part.params.join(', ')}]) {`);
    lines.push(...head, ...part.lines, '}');
  }
  const tasks: Module[] = [];
  for (const call of awaited.calls) {
    if (call.builtin) {
      lines.push('', ...emitBuiltinTask(call.tag, call.callee));
      continue;
    }
    const task = compileTask(scope, handler, call, diagnostics);
    if (task === undefined) {
      return undefined;
    }
    tasks.push(task);
  }
  return { code: `${lines.join('\n')}\n`, tasks, after: hasAfter };
}

/** Writes the `import` lines for the names the chunk uses. */
function emitImports(scope: Scope, used: ReadonlySet<string>): string[] {
  const statements: AstNode[] = [];
  const byStatement = new Map<AstNode, string[]>();
  for (const [name, binding] of scope.imports) {
    if (!used.has(name)) {
      continue;
    }
    if (!byStatement.has(binding.statement)) {
      statements.push(binding.statement);
      byStatement.set(binding.statement, []);
    }
    byStatement.get(binding.statement)?.push(name);
  }
  statements.sort((a, b) => a.start - b.start);
  const lines: string[] = [];
  for (const statement of statements) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    const keep = new Set(byStatement.get(statement));
    let defaultName: string | undefined;
    let namespace: string | undefined;
    const named: string[] = [];
    for (const specifier of statement.specifiers) {
      if (!keep.has(specifier.local.name)) {
        continue;
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        defaultName = specifier.local.name;
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespace = `* as ${specifier.local.name}`;
      } else {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.raw;
        const local = specifier.local.name;
        named.push(imported === local ? local : `${imported ?? ''} as ${local}`);
      }
    }
    const parts: string[] = [];
    if (defaultName !== undefined) {
      parts.push(defaultName);
    }
    if (namespace !== undefined) {
      parts.push(namespace);
    }
    if (named.length > 0) {
      parts.push(`{ ${named.join(', ')} }`);
    }
    const from = scope.source.slice(statement.source.start, statement.source.end);
    lines.push(`import ${parts.join(', ')} from ${from};`);
  }
  return lines;
}

/**
 * Compiles the handlers of a `*.tsx` file into client modules, one per handler.
 * `ir` is the analysis of the same source. Without it the source is analyzed here.
 */
export function compileHandlers(
  file: string,
  source: string,
  ir: ModuleIR = analyze(file, source),
): CompileHandlersResult {
  const diagnostics: CompileDiagnostic[] = [];
  for (const diagnostic of ir.diagnostics) {
    if (diagnostic.rule.startsWith('handler-') || diagnostic.rule.startsWith('await-')) {
      diagnostics.push(diagnostic);
    }
  }
  const component = pickComponent(ir);
  if (component === undefined) {
    return { client: [], diagnostics };
  }
  const program = parseSync(file, source, { lang: 'tsx' }).program;
  const scope = readScope(program, source, component);
  if (scope === undefined) {
    return { client: [], diagnostics };
  }
  const client: Module[] = [];
  let after = false;
  for (const handler of component.handlers) {
    const compiled = compileHandler(scope, handler, diagnostics);
    if (compiled !== undefined) {
      after ||= compiled.after;
      client.push({ chunk: `handler=${handler.name}`, code: compiled.code }, ...compiled.tasks);
    }
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      return { client: [], diagnostics };
    }
  }
  return after ? { client, diagnostics, after } : { client, diagnostics };
}
