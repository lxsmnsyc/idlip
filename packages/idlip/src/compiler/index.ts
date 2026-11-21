/**
 * The compiler that turns `*.idlip.tsx` files into view IR, chunks and the manifest.
 */
import type { CompileDiagnostic, CompileResult } from '../core/format.ts';
import { compileHandlers } from './update/index.ts';
import { analyze } from './view/analyze/index.ts';
import { generate } from './view/codegen/index.ts';

export { compileHandlers, listHandlerProps, pickComponent } from './update/index.ts';
export type { CompileHandlersResult } from './update/index.ts';
export * from './view/analyze/index.ts';
export { generate } from './view/codegen/index.ts';
export type { GenerateResult } from './view/codegen/index.ts';

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
 * Compiles one `*.idlip.tsx` file. `id` is the root-relative Vite id, such as
 * `/src/todo.idlip.tsx`. With an error diagnostic, `server` is empty, `client` is `[]` and the
 * manifest is empty, whichever part found the error.
 */
export function compile(source: string, id: string): CompileResult {
  // Analyze once and share the IR.
  const ir = analyze(id, source);
  const handlers = compileHandlers(id, source, ir);
  const view = generate(ir, source, id);

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
    manifest: view.manifest,
    diagnostics,
  };
}
