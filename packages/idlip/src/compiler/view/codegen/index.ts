// Emits the server render module, the binding and list chunks and the manifest from the view IR,
// as `contracts/compiled-format.md` fixes them. Handler chunks come from `compile-update`.
import { getChunkId } from '../../../core/format.ts';
import type {
  BindingGroup,
  CompileDiagnostic,
  HandlerEntry,
  ListEntry,
  Manifest,
  Module,
} from '../../../core/format.ts';
import { pickComponent } from '../../update/index.ts';
import type { Component, ModuleIR, Span } from '../analyze/index.ts';
import { emitBindings, emitGroupChunk, emitListChunk } from './chunks.ts';
import type { ChunkContext } from './chunks.ts';
import { Emitter, createUsage, mergeUsage } from './expr.ts';
import { HtmlBuilder, toExpression } from './html.ts';
import { ModuleSource } from './module.ts';
import { getStatePaths, planBindings, planGroups } from './plan.ts';
import type { Group, Plan } from './plan.ts';
import { getAccessor, getKey, getLocalName, printHelperImport, quote, toLiteral } from './text.ts';

export interface GenerateResult {
  /** The server module's code. Empty when a diagnostic is an error. */
  server: string;
  /** Binding group chunks and list item template chunks. Handler chunks are not included. */
  client: Module[];
  manifest: Manifest;
  diagnostics: CompileDiagnostic[];
}

function createEmptyManifest(id: string): Manifest {
  return { module: id, events: [], handlers: {}, groups: {}, lists: {} };
}

function buildManifest(id: string, component: Component, plan: Plan, groups: Group[]): Manifest {
  const handlers: Record<string, HandlerEntry> = {};
  for (const handler of component.handlers) {
    for (const segment of handler.segments) {
      handlers[segment.tag] = { chunk: `handler=${segment.tag}` };
    }
  }
  const groupEntries: Record<string, BindingGroup> = {};
  for (const group of groups) {
    const bindings: string[] = [];
    for (const binding of group.bindings) {
      bindings.push(binding.name);
    }
    groupEntries[group.key] = {
      paths: group.paths,
      chunk: `binding=${group.key}`,
      bindings,
      covers: group.covers,
    };
  }
  const lists: Record<string, ListEntry> = {};
  for (const info of plan.lists) {
    const bindings: string[] = [];
    for (const binding of plan.bindings) {
      if (binding.list === info.id) {
        bindings.push(binding.name);
      }
    }
    // The path is known when `each` is a plain path that reads one state path.
    const each = info.node.each;
    let path: string | undefined;
    if (each.expr.kind === 'path' && each.paths !== 'dynamic') {
      const paths = getStatePaths(each.paths, () => {}, each.span);
      if (paths.length === 1) {
        path = paths[0];
      }
    }
    lists[String(info.id)] = {
      key: info.node.key,
      ...(path === undefined ? {} : { path }),
      chunk: `list=${info.id}`,
      bindings,
      ...(info.parent === undefined ? {} : { parent: String(info.parent) }),
    };
  }
  return {
    module: id,
    events: plan.events,
    handlers,
    groups: groupEntries,
    lists,
  };
}

/** Generates the server module, the client chunks and the manifest of one `*.idlip.tsx` file. */
export function generate(ir: ModuleIR, source: string, id: string): GenerateResult {
  const diagnostics: CompileDiagnostic[] = [...ir.diagnostics];
  const report = (rule: string, message: string, span: Span): void => {
    diagnostics.push({ rule, severity: 'error', message, span });
  };
  const empty = (): GenerateResult => ({
    server: '',
    client: [],
    manifest: createEmptyManifest(id),
    diagnostics,
  });
  for (const diagnostic of ir.diagnostics) {
    if (diagnostic.severity === 'error') {
      return empty();
    }
  }
  const component = pickComponent(ir) ?? ir.components.at(0);
  if (component === undefined) {
    report('codegen-component', 'The file has no component', { start: 0, end: 0 });
    return empty();
  }

  // Plan which holes and events patch, then group them by path set.
  const plan = planBindings(component, report);
  const groupList = planGroups(plan.bindings);
  const groups = new Map<string, Group>();
  for (const group of groupList) {
    groups.set(group.key, group);
  }
  const moduleSource = new ModuleSource(ir.file, source);
  const context: ChunkContext = { component, plan, source: moduleSource, report };

  // Client chunks.
  const client: Module[] = [];
  const clientUsage = createUsage();
  const emitted = emitBindings(context);
  for (const group of groupList) {
    const chunk = emitGroupChunk(group, groups, emitted, context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }
  for (const info of plan.lists) {
    const chunk = emitListChunk(info, context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }

  const manifest = buildManifest(id, component, plan, groupList);
  const server = emitServer(id, component, plan, manifest, clientUsage.props, moduleSource, report);
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      return { ...empty(), manifest };
    }
  }
  return { server, client, manifest, diagnostics };
}

/** Emits the server module: the manifest, the chunk map and the render function. */
function emitServer(
  id: string,
  component: Component,
  plan: Plan,
  manifest: Manifest,
  clientProps: Set<string>,
  moduleSource: ModuleSource,
  report: ChunkContext['report'],
): string {
  const usage = createUsage();
  const emitter = new Emitter('server', usage, report);

  // Initial state.
  const lines: string[] = [];
  const model: string[] = [];
  for (const field of component.state) {
    const local = getLocalName(field.name);
    lines.push(`const ${local} = ${emitter.expr(field.init)};`);
    model.push(local === field.name ? local : `${getKey(field.name)}: ${local}`);
  }
  const props: string[] = [];
  for (const field of clientProps) {
    props.push(`${getKey(field)}: props${getAccessor(field, false)}`);
  }
  lines.push(
    `context.state({ manifest, chunks, model: { ${model.join(', ')} }, props: ${props.length === 0 ? '{}' : `{ ${props.join(', ')} }`} });`,
  );

  // The markup.
  const builder = new HtmlBuilder(component, plan, emitter);
  const built = builder.build(component.view);
  lines.push(...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`);

  // The chunk map writes each id as its own URL.
  const urls: string[] = [];
  const chunkNames: string[] = [];
  for (const handler of component.handlers) {
    for (const segment of handler.segments) {
      chunkNames.push(`handler=${segment.tag}`);
    }
  }
  for (const group of Object.values(manifest.groups)) {
    chunkNames.push(group.chunk);
  }
  for (const list of Object.values(manifest.lists)) {
    chunkNames.push(list.chunk);
  }
  for (const chunk of chunkNames) {
    const chunkId = quote(getChunkId(id, chunk));
    urls.push(`${chunkId}: ${chunkId},`);
  }

  // Assemble the module.
  const collected = moduleSource.collect(usage.modules, usage.imports);
  const imports: string[] = [];
  if (usage.helpers.size > 0) {
    imports.push(printHelperImport(usage.helpers, 'idlip/server'));
  }
  imports.push(...collected.imports);
  const blocks: string[] = [];
  if (imports.length > 0) {
    blocks.push(imports.join('\n'));
  }
  blocks.push(
    ...collected.code,
    `export const manifest = ${toLiteral(manifest)};`,
    `// \`vite-plugin\` replaces the URLs in a build.\nexport const chunks = {\n${urls.join('\n')}\n};`,
    `export default function ${component.name}(props, context) {\n${lines.join('\n')}\n}`,
  );
  return `${blocks.join('\n\n')}\n`;
}
