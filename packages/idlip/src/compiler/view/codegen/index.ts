// Emits the server render module, the binding and list chunks and the manifest from the view IR,
// as `contracts/compiled-format.md` fixes them. Handler chunks come from `compile-update`.
import { posix } from 'node:path';
import { getChunkId } from '../../../core/format.ts';
import type {
  BindingGroup,
  CompileDiagnostic,
  HandlerEntry,
  ListEntry,
  Manifest,
  Module,
} from '../../../core/format.ts';
import { HELPER_NAMES } from '../../../core/helpers.ts';
import { pickComponent } from '../../update/index.ts';
import { listWrites, meetsPath } from '../../update/writes.ts';
import type { Component, ModuleIR, Span } from '../analyze/index.ts';
import {
  emitBindings,
  emitGroupChunk,
  emitListChunk,
  emitTryChunk,
  emitViewChunk,
} from './chunks.ts';
import type { ChunkContext } from './chunks.ts';
import { Emitter, createUsage, mergeUsage } from './expr.ts';
import { HtmlBuilder, toExpression } from './html.ts';
import { ModuleSource } from './module.ts';
import { getTaskChunk, isBuiltinTask } from '../../update/tasks.ts';
import { emitSourceChunk } from './subscribe.ts';
import { getStatePaths, planBindings, planGroups } from './plan.ts';
import type { Binding, Group, Plan } from './plan.ts';
import { getAccessor, getKey, getLocalName, printHelperImport, quote, toLiteral } from './text.ts';

export interface GenerateResult {
  /** The server module's code. Empty when a diagnostic is an error. */
  server: string;
  /** Binding group chunks and list item template chunks. Handler chunks are not included. */
  client: Module[];
  manifest: Manifest;
  diagnostics: CompileDiagnostic[];
}

export interface GenerateOptions {
  /** True when a project module renders this module as a child: it gets a `view` chunk. */
  child?: boolean;
  /**
   * Returns the id of the module that an import specifier names. Vite resolves it. Without it,
   * a relative specifier is resolved against the id of the importer.
   */
  resolve?: (specifier: string, importer: string) => string;
}

function resolveSpecifier(specifier: string, importer: string): string {
  return specifier.startsWith('.') ? posix.join(posix.dirname(importer), specifier) : specifier;
}

/** The manifest of a module that a parent renders: `view` is in compiled-format v10. */
type ChildManifest = Manifest & { view?: { chunk: string } };

function createEmptyManifest(id: string): Manifest {
  return { module: id, events: [], handlers: {}, groups: {}, lists: {} };
}

/** Tells whether a path of the group meets a write. */
function meetsWrites(group: Group, writes: readonly string[]): boolean {
  for (const path of group.paths) {
    for (const write of writes) {
      if (meetsPath(path, write)) {
        return true;
      }
    }
  }
  return false;
}

/** Lists the groups to load with a handler: those that meet a write, minus covered ones. */
function listBindings(groups: readonly Group[], writes: readonly string[]): string[] {
  const met: Group[] = [];
  const covered = new Set<string>();
  for (const group of groups) {
    if (meetsWrites(group, writes)) {
      met.push(group);
      for (const key of group.covers) {
        covered.add(key);
      }
    }
  }
  const keys: string[] = [];
  for (const group of met) {
    if (!covered.has(group.key)) {
      keys.push(group.key);
    }
  }
  return keys;
}

function buildManifest(
  id: string,
  component: Component,
  plan: Plan,
  groups: Group[],
  writes: ReadonlyMap<string, readonly string[] | undefined>,
  child: boolean,
): ChildManifest {
  const handlers: Record<string, HandlerEntry> = {};
  const tasks: Record<string, string> = {};
  for (const handler of component.handlers) {
    const own = writes.get(handler.name);
    for (const segment of handler.segments) {
      // A continuation lives in the chunk of its handler, and has its write set.
      handlers[segment.tag] =
        own === undefined
          ? { chunk: `handler=${handler.name}` }
          : { chunk: `handler=${handler.name}`, writes: own, bindings: listBindings(groups, own) };
      const root = segment.awaits;
      if (root !== undefined) {
        const builtin = root.kind === 'import' && isBuiltinTask(root.name, root.source);
        tasks[segment.tag] = getTaskChunk(handler.name, segment.tag, builtin);
      }
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
      const paths = getStatePaths(each.paths, () => {}, each.span, child);
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
  const fallback: Record<string, string> = {};
  for (const info of plan.tries) {
    fallback[String(info.id)] = `try=${info.id}`;
  }
  return {
    module: id,
    events: plan.events,
    handlers,
    ...(Object.keys(tasks).length === 0 ? {} : { tasks }),
    ...(plan.sources.size === 0 ? {} : { sources: [...plan.sources.keys()] }),
    ...(plan.tries.length === 0 ? {} : { fallback }),
    groups: groupEntries,
    lists,
    ...(child ? { view: { chunk: 'view' } } : {}),
  };
}

/** Generates the server module, the client chunks and the manifest of one `*.idlip.tsx` file. */
export function generate(
  ir: ModuleIR,
  source: string,
  id: string,
  options: GenerateOptions = {},
): GenerateResult {
  const child = options.child === true;
  const resolve = options.resolve ?? resolveSpecifier;
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
  const plan = planBindings(component, report, child);
  for (const used of plan.uses) {
    used.module = resolve(used.source, id);
    used.view = getChunkId(used.module, 'view');
  }
  const groupList = planGroups(plan.bindings);
  const groups = new Map<string, Group>();
  for (const group of groupList) {
    groups.set(group.key, group);
  }
  const moduleSource = new ModuleSource(ir.file, source);
  // A module-level name that codegen also generates would be declared twice in a chunk.
  for (const found of moduleSource.findNames(new Set(HELPER_NAMES))) {
    report(
      'module-reserved-name',
      `The module-level name \`${found.name}\` is one that the compiler generates. Rename it.`,
      { start: found.start, end: found.end },
    );
  }
  if (diagnostics.length > ir.diagnostics.length) {
    return empty();
  }
  const byId = new Map<number, Binding>();
  for (const binding of plan.bindings) {
    byId.set(binding.id, binding);
  }
  const context: ChunkContext = { component, plan, byId, source: moduleSource, report };

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

  for (const info of plan.tries) {
    const chunk = emitTryChunk(info, context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }

  for (const [name, root] of plan.sources) {
    client.push(emitSourceChunk(name, root, context));
  }

  if (child) {
    const chunk = emitViewChunk(context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }

  const manifest = buildManifest(
    id,
    component,
    plan,
    groupList,
    listWrites(ir.file, source, component),
    child,
  );
  const server = emitServer(
    id,
    component,
    plan,
    manifest,
    clientUsage.props,
    moduleSource,
    report,
    child,
  );
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
  manifest: ChildManifest,
  clientProps: Set<string>,
  moduleSource: ModuleSource,
  report: ChunkContext['report'],
  child: boolean,
): string {
  const usage = createUsage();
  const emitter = new Emitter('server', usage, report);

  // Initial state.
  const lines: string[] = [];
  const model: string[] = [];
  for (const field of component.state) {
    const local = getLocalName(field.name);
    // A given model replaces the initial value, so a test can render the view of any model.
    lines.push(
      `const ${local} = model === undefined ? ${emitter.expr(field.init)} : model${getAccessor(field.name, false)};`,
    );
    model.push(local === field.name ? local : `${getKey(field.name)}: ${local}`);
  }
  const props: string[] = [];
  for (const field of clientProps) {
    props.push(`${getKey(field)}: props${getAccessor(field, false)}`);
  }
  // The root's path is `''`. A child gets its path from its parent.
  const parent = plan.uses.length > 0;
  const state = [
    'manifest',
    'chunks',
    ...(parent ? ['uses'] : []),
    `model: { ${model.join(', ')} }`,
    `props: ${props.length === 0 ? '{}' : `{ ${props.join(', ')} }`}`,
  ];
  lines.push(`context.state({ ${state.join(', ')} }${parent || child ? ', path' : ''});`);

  // The markup.
  const builder = new HtmlBuilder(component, plan, emitter);
  const built = builder.build(component.view);
  lines.push(...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`);

  // The chunk map writes each id as its own URL.
  const urls: string[] = [];
  const chunkNames: string[] = [];
  for (const entry of Object.values(manifest.handlers)) {
    if (!chunkNames.includes(entry.chunk)) {
      chunkNames.push(entry.chunk);
    }
  }
  for (const chunk of Object.values(manifest.tasks ?? {})) {
    if (!chunkNames.includes(chunk)) {
      chunkNames.push(chunk);
    }
  }
  for (const name of manifest.sources ?? []) {
    chunkNames.push(`source=${name}`);
  }
  for (const group of Object.values(manifest.groups)) {
    chunkNames.push(group.chunk);
  }
  for (const list of Object.values(manifest.lists)) {
    chunkNames.push(list.chunk);
  }
  for (const chunk of Object.values(manifest.fallback ?? {})) {
    chunkNames.push(chunk);
  }
  if (manifest.view !== undefined) {
    chunkNames.push(manifest.view.chunk);
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
  // A child module is imported by the specifier of the source. Vite resolves it.
  for (const used of plan.uses) {
    imports.push(`import * as ${used.name} from ${quote(used.source)};`);
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
  );
  if (parent) {
    const names = plan.uses.map((used) => used.name).join(', ');
    blocks.push(
      `// The server modules of the stateful children, so \`render()\` can write their manifests and\n// chunk URLs, also for children that no row renders yet.\nexport const uses = [${names}];`,
    );
  }
  // `path` is the model path of this component: the empty string for the root.
  let pathParameter = '';
  if (parent) {
    pathParameter = ", path = ''";
  } else if (child) {
    pathParameter = ', path';
  }
  blocks.push(
    `export default function ${component.name}(props, context, model${pathParameter}) {\n${lines.join('\n')}\n}`,
  );
  return `${blocks.join('\n\n')}\n`;
}
