// Emits the client chunks: binding groups and list item templates.
import type { Component } from '../analyze/index.ts';
import type { Module } from '../../../core/format.ts';
import { getMessage } from './events.ts';
import { Emitter, createUsage, mergeUsage } from './expr.ts';
import type { Frame, Report, ScopeName, Usage } from './expr.ts';
import { HtmlBuilder, toExpression } from './html.ts';
import type { ModuleSource } from './module.ts';
import type { Binding, Group, ListInfo, Plan } from './plan.ts';
import { getLocalName, printHelperImport, quote } from './text.ts';

export interface ChunkContext {
  component: Component;
  plan: Plan;
  /** The bindings of the plan by id. */
  byId: Map<number, Binding>;
  source: ModuleSource;
  report: Report;
}

interface Emitted {
  code: string;
  usage: Usage;
}

const SCOPE_ORDER: ScopeName[] = ['model', 'props', 'rows'];

/** Prints the destructured scope parameter, such as `{ model, rows }`, or an empty string. */
function printScope(usage: Usage): string {
  const names: string[] = [];
  for (const name of SCOPE_ORDER) {
    if (usage.scope.has(name)) {
      names.push(name);
    }
  }
  return names.length === 0 ? '' : `{ ${names.join(', ')} }`;
}

function printParams(first: string | undefined, usage: Usage): string {
  const params: string[] = [];
  if (first !== undefined) {
    params.push(first);
  }
  const scope = printScope(usage);
  if (scope !== '') {
    params.push(scope);
  }
  return params.join(', ');
}

/** Emits the export of one binding, and the functions it needs. */
function emitBinding(binding: Binding, context: ChunkContext): Emitted {
  const usage = createUsage();
  const emitter = new Emitter('client', usage, context.report);
  emitter.frames = binding.frames;
  const source = binding.source;
  switch (source.kind) {
    case 'attr': {
      emitter.at = source.hole.span;
      usage.helpers.add('setAttr');
      const value = emitter.expr(source.hole.expr, 1);
      const body = `setAttr$(el, ${quote(source.name)}, ${value});`;
      return {
        code: `export function ${binding.name}(${printParams('el', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'event': {
      usage.helpers.add('setOn');
      const message = getMessage(context.component, source.event, emitter);
      const body = `setOn$(el, ${quote(source.event.name)}, ${message.code});`;
      return {
        code: `export function ${binding.name}(${printParams('el', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'text': {
      emitter.at = source.hole.span;
      usage.helpers.add('setText');
      const body = `setText$(start, ${emitter.expr(source.hole.expr, 1)});`;
      return {
        code: `export function ${binding.name}(${printParams('start', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'list': {
      emitter.at = source.node.each.span;
      const body = `return ${emitter.expr(source.node.each.expr, 0)};`;
      return {
        code: `export function ${binding.name}(${printParams(undefined, usage)}) {\n${body}\n}`,
        usage,
      };
    }
    default:
      return emitCondition(binding, source.node, emitter, context);
  }
}

function emitCondition(
  binding: Binding,
  node: Extract<Binding['source'], { kind: 'condition' }>['node'],
  emitter: Emitter,
  context: ChunkContext,
): Emitted {
  const { usage } = emitter;
  emitter.at = node.test.span;
  usage.helpers.add('setBranch');
  const test = emitter.expr(node.test.expr, 2);
  // The branches print into their own usage, since the render function takes its own scope.
  const branchUsage = createUsage();
  const branchEmitter = new Emitter('client', branchUsage, context.report);
  branchEmitter.frames = emitter.frames;
  const builder = new HtmlBuilder(context.component, context.plan, branchEmitter);
  const thenBuilt = builder.build(node.then);
  const elseBuilt = builder.build(node.else);
  const render = `renderC${node.test.id}`;
  const scope = printScope(branchUsage);
  let body: string;
  if (thenBuilt.pre.length === 0 && elseBuilt.pre.length === 0) {
    body = `return branch === 0 ? ${toExpression(thenBuilt)} : ${toExpression(elseBuilt)};`;
  } else {
    body = [
      'if (branch === 0) {',
      ...thenBuilt.pre,
      `return ${toExpression({ pre: [], parts: thenBuilt.parts })};`,
      '}',
      ...elseBuilt.pre,
      `return ${toExpression({ pre: [], parts: elseBuilt.parts })};`,
    ].join('\n');
  }
  const renderFunction = `function ${render}(${scope === '' ? 'branch' : `branch, ${scope}`}) {\n${body}\n}`;
  mergeUsage(usage, branchUsage);
  // Only the scope the branches read goes to the render function.
  const reference = scope === '' ? render : `(branch) => ${render}(branch, ${scope})`;
  const namespace = node.namespace === 'html' ? '' : `, ${quote(node.namespace)}`;
  const call = `setBranch$(start, ${test} ? 0 : 1, ${reference}${namespace});`;
  return {
    code: `export function ${binding.name}(${printParams('start', usage)}) {\n${call}\n}\n\n${renderFunction}`,
    usage,
  };
}

export interface GroupChunk {
  module: Module;
  usage: Usage;
}

/** Emits the chunk of a group: its bindings, then the bindings of the groups it covers. */
export function emitGroupChunk(
  group: Group,
  groups: Map<string, Group>,
  emitted: Map<number, Emitted>,
  context: ChunkContext,
): GroupChunk {
  const usage = createUsage();
  const sections: string[] = [];
  for (const binding of group.bindings) {
    const item = emitted.get(binding.id);
    if (item !== undefined) {
      sections.push(item.code);
      mergeUsage(usage, item.usage);
    }
  }
  for (const key of group.covers) {
    const covered = groups.get(key);
    if (covered === undefined) {
      continue;
    }
    let first = true;
    for (const binding of covered.bindings) {
      const item = emitted.get(binding.id);
      if (item !== undefined) {
        sections.push(first ? `// Covers \`${key}\`.\n${item.code}` : item.code);
        first = false;
        mergeUsage(usage, item.usage);
      }
    }
  }
  addListExports(group, groups, emitted, context, sections, usage);
  return {
    module: { chunk: `binding=${group.key}`, code: assemble(usage, sections, context) },
    usage,
  };
}

/**
 * Exports the list binding of every list that holds a row binding of the chunk, up to the
 * outermost, so the patcher can reach the rows when only state outside the list changed.
 */
function addListExports(
  group: Group,
  groups: Map<string, Group>,
  emitted: Map<number, Emitted>,
  context: ChunkContext,
  sections: string[],
  usage: Usage,
): void {
  const chunkBindings: Binding[] = [...group.bindings];
  for (const key of group.covers) {
    chunkBindings.push(...(groups.get(key)?.bindings ?? []));
  }
  const present = new Set<number>();
  for (const binding of chunkBindings) {
    present.add(binding.id);
  }
  for (const binding of chunkBindings) {
    // A list's id is the id of its `l` binding.
    let owner = binding.list === undefined ? undefined : context.byId.get(binding.list);
    while (owner !== undefined && !present.has(owner.id)) {
      present.add(owner.id);
      const item = emitted.get(owner.id);
      if (item !== undefined) {
        sections.push(item.code);
        mergeUsage(usage, item.usage);
      }
      owner = owner.list === undefined ? undefined : context.byId.get(owner.list);
    }
  }
}

/** Joins the runtime import, the module's imports, its helpers and the code into a chunk. */
function assemble(usage: Usage, sections: string[], context: ChunkContext): string {
  const collected = context.source.collect(usage.modules, usage.imports);
  const imports: string[] = [];
  const runtime = printHelperImport(usage.helpers, 'idlip/client');
  if (runtime !== '') {
    imports.push(runtime);
  }
  imports.push(...collected.imports);
  const blocks: string[] = [];
  if (imports.length > 0) {
    blocks.push(imports.join('\n'));
  }
  blocks.push(...collected.code, ...sections);
  return `${blocks.join('\n\n')}\n`;
}

/** Emits every binding once, so groups that cover each other share the printed code. */
export function emitBindings(context: ChunkContext): Map<number, Emitted> {
  const emitted = new Map<number, Emitted>();
  for (const binding of context.plan.bindings) {
    emitted.set(binding.id, emitBinding(binding, context));
  }
  return emitted;
}

/** Emits the item template chunk of a list. */
export function emitListChunk(info: ListInfo, context: ChunkContext): GroupChunk {
  const usage = createUsage();
  const emitter = new Emitter('client', usage, context.report);
  const depth = info.frames.length;
  const frame: Frame = { item: info.node.item, index: info.node.index, row: undefined };
  emitter.frames = [...info.frames, frame];
  const builder = new HtmlBuilder(context.component, context.plan, emitter);
  const built = builder.build(info.node.body);
  // The row's own item and index are read from the new row.
  const lines: string[] = [];
  if (usage.vars.has(info.node.item)) {
    lines.push(`const ${getLocalName(info.node.item)} = rows[${depth}].item;`);
    usage.scope.add('rows');
  }
  if (info.node.index !== undefined && usage.vars.has(info.node.index)) {
    lines.push(`const ${getLocalName(info.node.index)} = rows[${depth}].index;`);
    usage.scope.add('rows');
  }
  lines.push(...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`);
  const sections = [`export function render(${printScope(usage)}) {\n${lines.join('\n')}\n}`];
  if (info.node.namespace !== 'html') {
    sections.push(`export const namespace = ${quote(info.node.namespace)};`);
  }
  return {
    module: { chunk: `list=${info.id}`, code: assemble(usage, sections, context) },
    usage,
  };
}
