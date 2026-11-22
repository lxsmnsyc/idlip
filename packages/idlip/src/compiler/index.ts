/**
 * The compiler that turns `*.tsx` files into view IR, chunks and the manifest.
 */
import type { CompileDiagnostic, CompileResult } from '../core/format.ts';
import { compileHandlers, pickComponent } from './update/index.ts';
import { analyze } from './view/analyze/index.ts';
import { generate } from './view/codegen/index.ts';
import type { GenerateOptions } from './view/codegen/index.ts';
import { planBindings } from './view/codegen/plan.ts';

export { compileHandlers, listHandlerProps, pickComponent } from './update/index.ts';
export type { CompileHandlersResult } from './update/index.ts';
export * from './view/analyze/index.ts';
export { generate } from './view/codegen/index.ts';
export type { GenerateOptions, GenerateResult } from './view/codegen/index.ts';

/** What `compile` takes besides the source: the options of `generate`. */
export type CompileOptions = GenerateOptions;

/**
 * Lists the specifiers of the stateful children a module renders, such as
 * `../counter/counter.tsx`. The Vite plugin compiles each of those modules as a child.
 */
export function listChildren(source: string, id: string): string[] {
  const ir = analyze(id, source);
  const component = pickComponent(ir) ?? ir.components.at(0);
  if (component === undefined) {
    return [];
  }
  const specifiers: string[] = [];
  for (const used of planBindings(component, () => {}, false).uses) {
    specifiers.push(used.source);
  }
  return specifiers;
}

/** Whether the list already holds a diagnostic of the same rule at the same place. */
function hasDiagnostic(list: readonly CompileDiagnostic[], diagnostic: CompileDiagnostic): boolean {
  for (const item of list) {
    if (item.rule === diagnostic.rule && item.span.start === diagnostic.span.start) {
      return true;
    }
  }
  return false;
}

/**
 * Compiles one `*.tsx` file. `id` is the root-relative Vite id, such as
 * `/src/todo.tsx`. With an error diagnostic, `server` is empty, `client` is `[]` and the
 * manifest is empty, whichever part found the error. `options.child` is true for a module that
 * another module renders as a child, and `options.resolve` names the module of a specifier.
 */
export function compile(source: string, id: string, options: CompileOptions = {}): CompileResult {
  // Analyze once and share the IR.
  const ir = analyze(id, source);
  const handlers = compileHandlers(id, source, ir);
  const view = generate(ir, source, id, options);

  // The view's list already holds the analysis diagnostics. Add the handler ones once.
  const diagnostics = [...view.diagnostics];
  for (const diagnostic of handlers.diagnostics) {
    if (!hasDiagnostic(diagnostics, diagnostic)) {
      diagnostics.push(diagnostic);
    }
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      return {
        server: '',
        client: [],
        manifest: { module: id, events: [], handlers: {}, groups: {}, lists: {} },
        diagnostics,
      };
    }
  }
  return {
    server: view.server,
    client: [...handlers.client, ...view.client],
    manifest: handlers.after === true ? { ...view.manifest, after: true } : view.manifest,
    diagnostics,
  };
}
