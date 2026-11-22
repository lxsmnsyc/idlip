// Emits the server render module, the binding and list chunks and the manifest from the view IR,
// as `contracts/compiled-format.md` fixes them. Handler chunks come from `compile-update`.
import { getChunkId, splitModule } from '../../../core/format.ts';
import type {
  BindingGroup,
  CompileDiagnostic,
  HandlerEntry,
  ListEntry,
  Manifest,
  Module,
} from '../../../core/format.ts';
import { HELPER_NAMES } from '../../../core/helpers.ts';
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
import { readImports, selectComponents } from './components.ts';
import type { SelectOptions, Selected } from './components.ts';
import { DYNAMIC_GROUP, DYNAMIC_STORE } from './dynamic.ts';
import { Emitter, createUsage, mergeUsage } from './expr.ts';
import type { Usage } from './expr.ts';
import { HtmlBuilder, toExpression } from './html.ts';
import { ModuleSource } from './module.ts';
import { resolveSpecifier } from './path.ts';
import { getTaskChunk, isBuiltinTask } from '../../update/tasks.ts';
import { emitSourceChunk } from './subscribe.ts';
import { getStatePaths, planBindings, planGroups } from './plan.ts';
import type { Binding, Group, ListInfo, Plan } from './plan.ts';
import { getAccessor, getKey, getLocalName, printHelperImport, quote, toLiteral } from './text.ts';

/** The manifest and view chunks of a component other than the file's first one. */
export interface GeneratedComponent {
  /** The component's name in the source. */
  name: string;
  manifest: Manifest;
  client: Module[];
}

export interface GenerateResult {
  /** The server module's code, for every component. Empty when a diagnostic is an error. */
  server: string;
  /** Binding group chunks and list item template chunks. Handler chunks are not included. */
  client: Module[];
  manifest: Manifest;
  /** The other components of the file. Absent when there are none. */
  components?: GeneratedComponent[];
  diagnostics: CompileDiagnostic[];
}

export interface GenerateOptions extends SelectOptions {
  /**
   * The components to generate, as `selectComponents` picked them. `compile` passes them, so
   * it can compile the handlers of the same components. Picked here when absent.
   */
  selected?: readonly Selected[];
  /**
   * Returns the id of the module that an import specifier names. Vite resolves it. Without it,
   * a relative specifier is resolved against the id of the importer.
   */
  resolve?: (specifier: string, importer: string) => string;
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
  // The paths of the dynamic holes are unknown until they run, so any handler may change one.
  for (const group of groups) {
    if (group.key === DYNAMIC_GROUP) {
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
    const path = getListPath(info, child);
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
    ...(plan.listens.size === 0 ? {} : { listens: Object.fromEntries(plan.listens) }),
    handlers,
    ...(Object.keys(tasks).length === 0 ? {} : { tasks }),
    ...(plan.sources.size === 0 ? {} : { sources: [...plan.sources.keys()] }),
    ...(plan.tries.length === 0 ? {} : { fallback }),
    ...(plan.heads.size === 0 ? {} : { head: true as const }),
    groups: groupEntries,
    lists,
    ...(child ? { view: { chunk: 'view' } } : {}),
  };
}

/** The path of `each` when it is a plain path that reads one state path. */
function getListPath(info: ListInfo, child: boolean): string | undefined {
  const each = info.node.each;
  if (each.expr.kind === 'path' && each.paths !== 'dynamic') {
    const paths = getStatePaths(each.paths, () => {}, each.span, child);
    if (paths.length === 1) {
      return paths[0];
    }
  }
  return undefined;
}

/** The planned parts of one component, before its chunks and server code are emitted. */
interface Planned {
  selected: Selected;
  plan: Plan;
}

/** The emitted parts of one component: its chunks, manifest and the pieces of its server code. */
interface Emitted {
  selected: Selected;
  plan: Plan;
  client: Module[];
  manifest: ChildManifest;
  server: ServerPart;
}

/**
 * Generates the server module, the client chunks and the manifests of one `*.tsx` file: one
 * manifest and one set of chunks per component that `selectComponents` picks.
 */
export function generate(
  ir: ModuleIR,
  source: string,
  id: string,
  options: GenerateOptions = {},
): GenerateResult {
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

  // Pick the components. `compile` passes the ones it picked, with their diagnostics.
  let selected = options.selected;
  if (selected === undefined) {
    const selection = selectComponents(ir, source, id, options);
    diagnostics.push(...selection.diagnostics);
    selected = selection.selected;
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      return empty();
    }
  }
  if (selected.length === 0) {
    report('codegen-component', 'The file has no component', { start: 0, end: 0 });
    return empty();
  }
  const count = diagnostics.length;

  // Plan which holes and events patch, and name the module of each child.
  const byName = new Map<string, Selected>();
  for (const item of selected) {
    byName.set(item.component.name, item);
  }
  const imports = readImports(ir.file, source);
  const planned: Planned[] = [];
  for (const item of selected) {
    const plan = planBindings(item.component, report, item.child);
    for (const used of plan.uses) {
      const local = used.source === '' ? byName.get(used.name) : undefined;
      if (used.source === '' && local === undefined) {
        report(
          'codegen-unsupported',
          `<${used.name}> is not a component of this file. Declare it with \`function ${used.name}(props) { … }\``,
          { start: 0, end: 0 },
        );
        continue;
      }
      if (local === undefined) {
        // A named import adds the component's name to the id of its file.
        const imported = imports.get(used.name)?.imported ?? 'default';
        const file = resolve(used.source, id);
        used.module = imported === 'default' ? file : `${file}#${imported}`;
      } else {
        used.module = local.module;
        used.ref = `$${local.component.name}`;
      }
      used.view = getChunkId(used.module, 'view');
    }
    planned.push({ selected: item, plan });
  }

  // A module-level name that codegen also generates would be declared twice in a chunk.
  const moduleSource = new ModuleSource(ir.file, source);
  // Every component other than the main one has a record `$<Name>`. The main one gets a record
  // too when another component of the file renders it.
  const reserved = new Set(HELPER_NAMES);
  for (const item of selected) {
    if (!item.main || selected.length > 1) {
      reserved.add(`$${item.component.name}`);
    }
  }
  for (const found of moduleSource.findNames(reserved)) {
    report(
      'module-reserved-name',
      `The module-level name \`${found.name}\` is one that the compiler generates. Rename it.`,
      { start: found.start, end: found.end },
    );
  }
  if (diagnostics.length > count) {
    return empty();
  }

  // Emit the chunks, manifest and server code of each component.
  const emitted: Emitted[] = [];
  for (const { selected: item, plan } of planned) {
    emitted.push(emitComponent(item, plan, ir, source, moduleSource, report));
  }
  const first = emitted[0];
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      return { ...empty(), manifest: first.manifest };
    }
  }
  const server = assembleServer(emitted, moduleSource);
  const rest: GeneratedComponent[] = [];
  for (const item of emitted.slice(1)) {
    rest.push({ name: item.selected.component.name, manifest: item.manifest, client: item.client });
  }
  return {
    server,
    client: first.client,
    manifest: first.manifest,
    ...(rest.length === 0 ? {} : { components: rest }),
    diagnostics,
  };
}

/** Emits the client chunks, the manifest and the server code of one component. */
function emitComponent(
  selected: Selected,
  plan: Plan,
  ir: ModuleIR,
  source: string,
  moduleSource: ModuleSource,
  report: ChunkContext['report'],
): Emitted {
  const { component, module: id, child } = selected;

  // The dynamic holes share one group at the end, whose paths the page state records.
  const staticBindings: Binding[] = [];
  const dynamicBindings: Binding[] = [];
  for (const binding of plan.bindings) {
    (binding.dynamic === true ? dynamicBindings : staticBindings).push(binding);
  }
  const groupList = planGroups(staticBindings);
  if (dynamicBindings.length > 0) {
    groupList.push({ key: DYNAMIC_GROUP, paths: [], bindings: dynamicBindings, covers: [] });
  }
  const groups = new Map<string, Group>();
  for (const group of groupList) {
    groups.set(group.key, group);
  }
  const byId = new Map<number, Binding>();
  for (const binding of plan.bindings) {
    byId.set(binding.id, binding);
  }
  const context: ChunkContext = { component, plan, byId, source: moduleSource, report };

  // Client chunks.
  const client: Module[] = [];
  const clientUsage = createUsage();
  const bindings = emitBindings(context);
  for (const group of groupList) {
    const chunk = emitGroupChunk(group, groups, bindings, context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }
  for (const info of plan.lists) {
    const chunk = emitListChunk(info, context);
    client.push(chunk.module);
    mergeUsage(clientUsage, chunk.usage);
  }

  const listPaths: Record<string, string> = {};
  for (const info of plan.lists) {
    const path = getListPath(info, child);
    if (path !== undefined) {
      listPaths[String(info.id)] = path;
    }
  }
  for (const info of plan.tries) {
    const chunk = emitTryChunk(info, context, listPaths);
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
  const server = emitServer(id, component, plan, manifest, clientUsage.props, report, child);
  return { selected, plan, client, manifest, server };
}

/** The server code of one component, before the file's module is assembled. */
interface ServerPart {
  /** The render function's body, one statement a line. */
  lines: string[];
  /** The entries of the chunk map, one `'<id>': '<id>',` a line. */
  urls: string[];
  /** The helpers, module-level names and imports the render function reads. */
  usage: Usage;
  /** `''`, `', path'` or `", path = ''"`. */
  pathParameter: string;
}

/** Emits the render function's body and the chunk map of one component. */
function emitServer(
  id: string,
  component: Component,
  plan: Plan,
  manifest: ChildManifest,
  clientProps: Set<string>,
  report: ChunkContext['report'],
  child: boolean,
): ServerPart {
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
  // The root's path is `''`. A child gets its path from its parent. A component other than the
  // main one reads its manifest, chunks and children from its module record.
  const parent = plan.uses.length > 0;
  const record = id.includes('#') ? `$${component.name}` : undefined;
  const fields =
    record === undefined
      ? ['manifest', 'chunks', ...(parent ? ['uses'] : [])]
      : [
          `manifest: ${record}.manifest`,
          `chunks: ${record}.chunks`,
          ...(parent ? [`uses: ${record}.uses`] : []),
        ];
  const state = [
    ...fields,
    `model: { ${model.join(', ')} }`,
    `props: ${props.length === 0 ? '{}' : `{ ${props.join(', ')} }`}`,
    ...(plan.dynamic.size === 0 ? [] : [`dynamic: ${DYNAMIC_STORE}`]),
  ];
  // Each dynamic hole stores the paths it read as the markup is built.
  if (plan.dynamic.size > 0) {
    lines.push(`const ${DYNAMIC_STORE} = {};`);
  }
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

  // `path` is the model path of this component: the empty string for the root.
  let pathParameter = '';
  if (parent) {
    pathParameter = ", path = ''";
  } else if (child) {
    pathParameter = ', path';
  }
  return { lines, urls, usage, pathParameter };
}

/**
 * Joins the server code of every component into the file's server module. The main component
 * exports `manifest`, `chunks`, `uses` and its render function as `default`. Every other one
 * has a module record `$<Name>` with the same fields and its render function under its name.
 */
function assembleServer(emitted: readonly Emitted[], moduleSource: ModuleSource): string {
  // Imports: the helpers, the children's server modules, and what module-level code needs.
  const helpers = new Set<string>();
  const modules = new Set<string>();
  const imported = new Set<string>();
  const childImports: string[] = [];
  const importedNames = new Set<string>();
  const localRefs = new Set<string>();
  for (const { server, plan } of emitted) {
    for (const name of server.usage.helpers) {
      helpers.add(name);
    }
    for (const name of server.usage.modules) {
      modules.add(name);
    }
    for (const name of server.usage.imports) {
      imported.add(name);
    }
    // A default import reads the module's namespace, a named one the component's record.
    for (const used of plan.uses) {
      if (used.source === '') {
        localRefs.add(used.ref);
      } else if (!importedNames.has(used.name)) {
        importedNames.add(used.name);
        const name = splitModule(used.module).name;
        childImports.push(
          name === undefined
            ? `import * as ${used.name} from ${quote(used.source)};`
            : `import { $${name} as ${used.name} } from ${quote(used.source)};`,
        );
      }
    }
  }
  const collected = moduleSource.collect(modules, imported);
  const imports: string[] = [];
  if (helpers.size > 0) {
    imports.push(printHelperImport(helpers, 'idlip/server'));
  }
  // A child module is imported by the specifier of the source. Vite resolves it.
  imports.push(...childImports, ...collected.imports);
  const blocks: string[] = [];
  if (imports.length > 0) {
    blocks.push(imports.join('\n'));
  }
  blocks.push(...collected.code);

  // The manifests and chunk maps. Records come before any `uses` list that names them.
  const uses: string[] = [];
  const functions: string[] = [];
  for (const { selected, plan, manifest, server } of emitted) {
    const name = selected.component.name;
    const record = `$${name}`;
    const parent = plan.uses.length > 0;
    const refs: string[] = [];
    for (const used of plan.uses) {
      refs.push(used.ref);
    }
    const children = refs.join(', ');
    const urls = `{\n${server.urls.join('\n')}\n}`;
    if (selected.main) {
      blocks.push(
        `export const manifest = ${toLiteral(manifest)};`,
        `// \`vite-plugin\` replaces the URLs in a build.\nexport const chunks = ${urls};`,
      );
      if (localRefs.has(record)) {
        blocks.push(
          `// The module record of ${name}, for the components of this file that render it.\nconst ${record} = { manifest, chunks, default: ${name} };`,
        );
        if (parent) {
          uses.push(`${record}.uses = uses;`);
        }
      }
      if (parent) {
        uses.unshift(
          `// The server modules of the stateful children, so \`render()\` can write their manifests and\n// chunk URLs, also for children that no row renders yet.\nexport const uses = [${children}];`,
        );
      }
      functions.push(
        `export default function ${name}(props, context, model${server.pathParameter}) {\n${server.lines.join('\n')}\n}`,
      );
      continue;
    }
    const keyword = selected.exported ? 'export ' : '';
    blocks.push(
      `// The module record of ${name}: what a parent's \`uses\` and \`render()\` read.\n${keyword}const ${record} = {\nmanifest: ${toLiteral(manifest)},\n// \`vite-plugin\` replaces the URLs in a build.\nchunks: ${urls},\ndefault: ${name},\n};`,
    );
    if (parent) {
      uses.push(`${record}.uses = [${children}];`);
    }
    functions.push(
      `${keyword}function ${name}(props, context, model${server.pathParameter}) {\n${server.lines.join('\n')}\n}`,
    );
  }
  // The `uses` lists run after every record exists, so components of one file may render each
  // other in any order.
  if (uses.length > 0) {
    blocks.push(uses.join('\n'));
  }
  blocks.push(...functions);
  return `${blocks.join('\n\n')}\n`;
}
