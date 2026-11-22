/**
 * The compiler that turns `*.tsx` files into view IR, chunks and the manifest.
 */
import type {
  CompileDiagnostic,
  CompileResult,
  CompiledComponent,
  Manifest,
  Module,
} from '../core/format.ts';
import { compileHandlers } from './update/index.ts';
import { analyze } from './view/analyze/index.ts';
import { generate } from './view/codegen/index.ts';
import type { GenerateOptions } from './view/codegen/index.ts';
import { readImports, selectComponents } from './view/codegen/components.ts';
import { planBindings } from './view/codegen/plan.ts';

export { compileHandlers, listHandlerProps, pickComponent } from './update/index.ts';
export type { CompileHandlersResult } from './update/index.ts';
export * from './view/analyze/index.ts';
export { generate } from './view/codegen/index.ts';
export type {
  GenerateOptions,
  GenerateResult,
  GeneratedComponent,
} from './view/codegen/index.ts';
export { selectComponents } from './view/codegen/components.ts';
export type { SelectOptions, Selected } from './view/codegen/components.ts';

/** What `compile` takes besides the source: the options of `generate`. */
export type CompileOptions = Omit<GenerateOptions, 'selected'>;

/** A stateful child that a file renders from another file. */
export interface ChildImport {
  /** The specifier, such as `./widgets.tsx`. */
  source: string;
  /** The imported name: `default`, or the name of a named component such as `Counter`. */
  imported: string;
}

/**
 * Lists the stateful children that the components of a file render from other files, each once,
 * such as `{ source: './widgets.tsx', imported: 'Counter' }`. The Vite plugin compiles each of
 * those components as a child.
 */
export function listChildImports(source: string, id: string): ChildImport[] {
  const ir = analyze(id, source);
  const { selected } = selectComponents(ir, source, id);
  const imports = readImports(id, source);
  const found: ChildImport[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    for (const used of planBindings(item.component, () => {}, false).uses) {
      if (used.source === '' || seen.has(used.name)) {
        continue;
      }
      seen.add(used.name);
      found.push({ source: used.source, imported: imports.get(used.name)?.imported ?? 'default' });
    }
  }
  return found;
}

/**
 * Lists the specifiers of the stateful children a module renders, such as
 * `../counter/counter.tsx`, each once.
 */
export function listChildren(source: string, id: string): string[] {
  const specifiers: string[] = [];
  for (const child of listChildImports(source, id)) {
    if (!specifiers.includes(child.source)) {
      specifiers.push(child.source);
    }
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

/** Adds the diagnostics that the list does not hold yet. */
function addDiagnostics(
  list: CompileDiagnostic[],
  diagnostics: readonly CompileDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    if (!hasDiagnostic(list, diagnostic)) {
      list.push(diagnostic);
    }
  }
}

/** Joins one component's handler chunks and view output. */
function joinComponent(
  manifest: Manifest,
  handlers: { client: readonly Module[]; after?: true } | undefined,
  view: readonly Module[],
): CompiledComponent {
  return {
    manifest: handlers?.after === true ? { ...manifest, after: true } : manifest,
    client: [...(handlers?.client ?? []), ...view],
  };
}

/**
 * Compiles one `*.tsx` file. `id` is the root-relative Vite id, such as
 * `/src/todo.tsx`. With an error diagnostic, `server` is empty, `client` is `[]` and the
 * manifest is empty, whichever part found the error. `options.child` is true when another
 * module renders the default export as a child, `options.children` names the named components
 * that other modules render, and `options.resolve` names the module of a specifier.
 */
export function compile(source: string, id: string, options: CompileOptions = {}): CompileResult {
  // Analyze once and share the IR. Pick the components once for the handlers and the view.
  const ir = analyze(id, source);
  const selection = selectComponents(ir, source, id, options);
  const view = generate(ir, source, id, { ...options, selected: selection.selected });
  const diagnostics = [...view.diagnostics];
  addDiagnostics(diagnostics, selection.diagnostics);

  // The handlers of each component. The view's list already holds the analysis diagnostics.
  const handlers: { client: readonly Module[]; after?: true }[] = [];
  for (const item of selection.selected) {
    const result = compileHandlers(id, source, ir, item.component);
    handlers.push(result);
    addDiagnostics(diagnostics, result.diagnostics);
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

  // Each component's handler chunks come before its view chunks.
  const first = joinComponent(view.manifest, handlers.at(0), view.client);
  const components: CompiledComponent[] = [];
  for (const [index, item] of (view.components ?? []).entries()) {
    components.push(joinComponent(item.manifest, handlers.at(index + 1), item.client));
  }
  return {
    server: view.server,
    client: first.client,
    manifest: first.manifest,
    ...(components.length === 0 ? {} : { components }),
    diagnostics,
  };
}
