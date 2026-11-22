// Emits the client chunks: binding groups and list item templates.
import { HELPERS_MODULE } from '../../../core/helpers.ts';
import type { Component, Expr } from '../analyze/index.ts';
import type { Module } from '../../../core/format.ts';
import { printSlot } from './child.ts';
import { emitHeadBody } from './head.ts';
import { printHtmlBody } from './raw.ts';
import { emitSubscribeBinding } from './subscribe.ts';
import { getMessage } from './events.ts';
import { printTracked } from './dynamic.ts';
import { Emitter, createUsage, mergeUsage } from './expr.ts';
import type { Frame, Report, ScopeName, Usage } from './expr.ts';
import { HtmlBuilder, toExpression } from './html.ts';
import type { ModuleSource } from './module.ts';
import type { Binding, Group, ListInfo, Plan, TryInfo } from './plan.ts';
import { buildBody, canClone, createCloneContext } from './template.ts';
import { getKey, getLocalName, quote } from './text.ts';

export interface ChunkContext {
  component: Component;
  plan: Plan;
  /** The bindings of the plan by id. */
  byId: Map<number, Binding>;
  source: ModuleSource;
  report: Report;
}

export interface Emitted {
  code: string;
  usage: Usage;
}

const SCOPE_ORDER: ScopeName[] = ['model', 'props', 'rows', 'dynamic'];

/**
 * Prints the scope as the destructured parameter, such as `{ model, rows }`, or an empty string.
 * `definition` is for a parameter, where the path defaults to the root's `''`. Without it the
 * text is an object literal that passes the scope on.
 */
function printScope(usage: Usage, definition = false): string {
  const names: string[] = [];
  for (const name of SCOPE_ORDER) {
    if (usage.scope.has(name)) {
      names.push(name);
    }
  }
  if (usage.path) {
    names.push(definition ? "path = ''" : 'path');
  }
  return names.length === 0 ? '' : `{ ${names.join(', ')} }`;
}

function printParams(first: string | undefined, usage: Usage): string {
  const params: string[] = [];
  if (first !== undefined) {
    params.push(first);
  }
  const scope = printScope(usage, true);
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
    case 'prop':
    case 'message':
      return emitPropBinding(binding, context);
    case 'attr': {
      emitter.at = source.hole.span;
      usage.helpers.add('setAttr');
      let value = binding.dynamic
        ? printTracked(emitter, context.component, source.hole, binding.name)
        : emitter.expr(source.hole.expr, 1);
      if (source.url !== undefined) {
        usage.helpers.add('safeUrl');
        value = `safeUrl$(${value}, ${quote(source.name)}${source.url === 'embed' ? ', true' : ''})`;
      }
      const body = `setAttr$(el, ${quote(source.name)}, ${value});`;
      return {
        code: `export function ${binding.name}(${printParams('el', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'html': {
      const body = printHtmlBody(source, emitter);
      return {
        code: `export function ${binding.name}(${printParams('el', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'head-attr':
    case 'head-title': {
      const body = emitHeadBody(source, emitter);
      return {
        code: `export function ${binding.name}(${printParams('el', usage)}) {\n${body}\n}`,
        usage,
      };
    }
    case 'subscribe':
      return emitSubscribeBinding(binding, source.node, emitter);
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
      const value = binding.dynamic
        ? printTracked(emitter, context.component, source.hole, binding.name)
        : emitter.expr(source.hole.expr, 1);
      const body = `setText$(start, ${value});`;
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
  const clone = createCloneContext(context.component, context.plan, branchEmitter);
  // A branch that writes a value clones its templates. Other branches render HTML.
  let cloned = false;
  const branches: string[][] = [];
  const expressions: string[] = [];
  for (const [index, nodes] of [node.then, node.else].entries()) {
    if (canClone(nodes, context.component, context.plan)) {
      const body = buildBody(nodes, node.namespace, `templateC${node.test.id}_${index}$`, clone);
      branches.push([...body.pre, `return ${body.expr};`]);
      cloned = true;
      continue;
    }
    const built = builder.build(nodes);
    if (built.pre.length === 0) {
      expressions.push(toExpression(built));
    }
    branches.push([...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`]);
  }
  const render = `renderC${node.test.id}`;
  const scope = printScope(branchUsage);
  const parameter = printScope(branchUsage, true);
  const body =
    expressions.length === 2
      ? `return branch === 0 ? ${expressions[0]} : ${expressions[1]};`
      : ['if (branch === 0) {', ...branches[0], '}', ...branches[1]].join('\n');
  // `setBranch$` passes the document, which a branch that clones takes after the branch.
  const head = cloned ? 'branch, $doc' : 'branch';
  const renderFunction = `function ${render}(${parameter === '' ? head : `${head}, ${parameter}`}) {\n${body}\n}`;
  mergeUsage(usage, branchUsage);
  // Only the scope the branches read goes to the render function.
  const reference = scope === '' ? render : `(${head}) => ${render}(${head}, ${scope})`;
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

/**
 * Joins the loader import, the helpers import, the module's imports, the module's helpers and
 * the code into a chunk.
 */
function assemble(usage: Usage, sections: string[], context: ChunkContext): string {
  const collected = context.source.collect(usage.modules, usage.imports);
  const imports: string[] = [];
  if (usage.loader.size > 0) {
    imports.push(`import { ${[...usage.loader].sort().join(', ')} } from 'idlip/client';`);
  }
  // The runtime helpers come from one shared module, which the loader loads with the first chunk.
  if (usage.helpers.size > 0) {
    const names: string[] = [];
    for (const name of [...usage.helpers].sort()) {
      names.push(`${name}$`);
    }
    imports.push(`import { ${names.join(', ')} } from '${HELPERS_MODULE}';`);
  }
  // A view is imported by name, not as a namespace. The view is also an entry, and a namespace
  // object is an export the entry does not have, so the bundler split the view into a second
  // file behind a re-exporting entry file.
  const views: string[] = [];
  for (const [name, id] of usage.views) {
    imports.push(`import { init as $init_${name}, render as $render_${name} } from ${quote(id)};`);
    views.push(`const ${name} = { init: $init_${name}, render: $render_${name} };`);
  }
  imports.push(...collected.imports);
  const blocks: string[] = [];
  if (imports.length > 0) {
    blocks.push(imports.join('\n'));
  }
  if (views.length > 0) {
    blocks.push(views.join('\n'));
  }
  // Cloned templates, once each: two bindings of a chunk may render the same block.
  if (usage.templates.size > 0) {
    blocks.push([...usage.templates.values()].join('\n'));
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
  // A row that writes a value clones a template that holds its row markers. Other rows render
  // HTML.
  let body: string[];
  let cloned = false;
  let blocks = false;
  if (canClone(info.node.body, context.component, context.plan)) {
    const clone = createCloneContext(context.component, context.plan, emitter);
    const built = buildBody(
      info.node.body,
      info.node.namespace,
      `templateL${info.id}$`,
      clone,
      true,
    );
    body = [...built.pre, `return ${built.expr};`];
    cloned = true;
    blocks = built.blocks;
  } else {
    const built = builder.build(info.node.body);
    body = [...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`];
  }
  // The row's own item and index are read from the new row. A template that adds children
  // also reads the path of the scope, so it takes the whole scope.
  const scoped = usage.path;
  const rows = scoped ? 'scope.rows' : 'rows';
  const lines: string[] = [];
  if (usage.vars.has(info.node.item)) {
    lines.push(`const ${getLocalName(info.node.item)} = ${rows}[${depth}].item;`);
    if (!scoped) {
      usage.scope.add('rows');
    }
  }
  if (info.node.index !== undefined && usage.vars.has(info.node.index)) {
    lines.push(`const ${getLocalName(info.node.index)} = ${rows}[${depth}].index;`);
    if (!scoped) {
      usage.scope.add('rows');
    }
  }
  let parameter: string;
  if (scoped) {
    parameter = 'scope';
    // The own row is read from `scope.rows`. The rows around the list are destructured.
    const names: string[] = [];
    for (const name of SCOPE_ORDER) {
      if (usage.scope.has(name)) {
        names.push(name);
      }
    }
    if (names.length > 0) {
      lines.unshift(`const { ${names.join(', ')} } = scope;`);
    }
    lines.push("const path = scope.path ?? '';");
  } else {
    parameter = printScope(usage);
  }
  lines.push(...body);
  const sections: string[] = [];
  let comment = '';
  if (scoped) {
    comment = cloned
      ? "// `addChild` makes the child's model from `init`, records the slot and returns the child's\n// nodes, which go between the boundary comments of the template.\n"
      : "// `addChild` makes the child's model from `init`, records the slot and returns the child's\n// markup between its boundary comments.\n";
  }
  // `patchList` passes the document, which a row that clones takes after the scope.
  if (cloned) {
    parameter = `${parameter === '' ? '$scope' : parameter}, $doc`;
  }
  sections.push(`${comment}export function render(${parameter}) {\n${lines.join('\n')}\n}`);
  if (info.node.key.kind === 'computed') {
    // The client pairs rows by this key, so it loads the chunk before it pairs them. The key
    // reads only its item, which is the parameter.
    const keyUsage = createUsage();
    const keyEmitter = new Emitter('client', keyUsage, context.report);
    keyEmitter.frames = [frame];
    const code = keyEmitter.expr(info.node.key.expr, 0);
    for (const name of keyUsage.helpers) {
      usage.helpers.add(name);
    }
    for (const name of keyUsage.modules) {
      usage.modules.add(name);
    }
    sections.push(`export function key(${getLocalName(info.node.item)}) {\nreturn ${code};\n}`);
  }
  if (info.node.namespace !== 'html') {
    sections.push(`export const namespace = ${quote(info.node.namespace)};`);
  }
  // A cloned row that holds a block tells `patchList` to run the block hooks for it.
  if (blocks) {
    sections.push('export const blocks = true;');
  }
  return {
    module: { chunk: `list=${info.id}`, code: assemble(usage, sections, context) },
    usage,
  };
}

/**
 * Emits the chunk of a `<Try>` region. `render(error, scope, doc)` returns the catch view, with
 * `error` the message of what was thrown, a string: a cloned fragment, or HTML for a static
 * view. A catch view with `reset` also gets `region(scope, start)`: the whole region with its
 * markers, cloned in the document of `start`, for the reset. A region inside a `<For>` reads its
 * rows from the DOM around `start`, with `listPaths`, the `each` path of each list.
 */
export function emitTryChunk(
  info: TryInfo,
  context: ChunkContext,
  listPaths: Readonly<Record<string, string>>,
): GroupChunk {
  const usage = createUsage();
  const emitter = new Emitter('client', usage, context.report);
  emitter.frames = info.frames;
  const { component, plan } = context;
  const { node } = info;
  let body: string[];
  const cloned = canClone(node.catch, component, plan);
  if (cloned) {
    const clone = createCloneContext(component, plan, emitter);
    clone.catching.push(info.id);
    const built = buildBody(node.catch, node.namespace, `templateE${info.id}_1$`, clone);
    body = [...built.pre, `return ${built.expr};`];
  } else {
    const builder = new HtmlBuilder(component, plan, emitter);
    const built = builder.buildCatch(node, info.id);
    body = [...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`];
  }
  const error = getLocalName(node.error);
  // A view that clones takes the document after the scope.
  let parameters = printParams(error, usage);
  if (cloned) {
    parameters += `${parameters === error ? ', $scope' : ''}, $doc`;
  }
  const sections = [`export function render(${parameters}) {\n${body.join('\n')}\n}`];
  if (node.reset !== undefined) {
    const clone = createCloneContext(component, plan, emitter);
    const whole = buildBody([node], node.namespace, `templateR${info.id}$`, clone);
    const lines = ['const $doc = start.ownerDocument;', ...whole.pre, `return ${whole.expr};`];
    if (info.frames.length > 0) {
      // The rows are read at the reset, not passed in.
      usage.helpers.add('getRows');
      usage.scope.delete('rows');
      usage.scope.add('model');
      lines.unshift('const rows = getRows$(start, model, lists$);');
      sections.push(`const lists$ = ${JSON.stringify(listPaths)};`);
    }
    const params = printParams(undefined, usage);
    sections.push(
      `export function region(${params === '' ? '$scope' : params}, start) {\n${lines.join('\n')}\n}`,
    );
  }
  if (info.node.namespace !== 'html') {
    sections.push(`export const namespace = ${quote(info.node.namespace)};`);
  }
  return {
    module: { chunk: `try=${info.id}`, code: assemble(usage, sections, context) },
    usage,
  };
}

/** The first comment of a props binding that sets a prop. */
const PROP_COMMENT =
  '// A props binding: it has no node. It tells the loader the new value of one prop of a slot.';

/** Emits `p<id>`: it tells the loader the new value of one prop of one child slot. */
function emitPropBinding(binding: Binding, context: ChunkContext): Emitted {
  const usage = createUsage();
  const emitter = new Emitter('client', usage, context.report);
  // The rows are read into variables, so the code reads the same as in a template.
  const rows: { name: string; read: string }[] = [];
  for (const [depth, frame] of binding.frames.entries()) {
    emitter.frames.push({ item: frame.item, index: frame.index, row: undefined });
    rows.push({ name: frame.item, read: `scope.rows[${depth}].item` });
    if (frame.index !== undefined) {
      rows.push({ name: frame.index, read: `scope.rows[${depth}].index` });
    }
  }
  const { source } = binding;
  let comment: string;
  let call: string;
  let path = "scope.path ?? ''";
  let hoisted = false;
  if (source.kind === 'prop') {
    comment = PROP_COMMENT;
    const slot = printSlot(emitter, context.plan, source.child, path);
    emitter.at = source.hole.span;
    call = `setProp(${slot}, ${quote(source.name)}, ${emitter.expr(source.hole.expr, 1)});`;
  } else if (source.kind === 'message') {
    path = 'path';
    hoisted = true;
    const { event } = source;
    const slot = printSlot(emitter, context.plan, source.child, path);
    const message = getMessage(context.component, event, emitter, path).code;
    comment =
      event.target.kind === 'handler'
        ? `// The message prop carries the path of this component as its owner, so the child's click\n// reaches \`${event.target.name}\` here and not a handler of the child.`
        : '// A message prop that the component forwards keeps the owner that its parent gave it.';
    call = `setProp(${slot}, ${quote(event.name)}, ${message});`;
  } else {
    throw new Error(`${binding.name} is not a props binding`);
  }
  usage.loader.add('setProp');
  const lines: string[] = [];
  const names: string[] = [];
  for (const name of ['model', 'props'] as const) {
    if (usage.scope.has(name)) {
      names.push(name);
    }
  }
  if (names.length > 0) {
    lines.push(`const { ${names.join(', ')} } = scope;`);
  }
  for (const row of rows) {
    if (usage.vars.has(row.name)) {
      lines.push(`const ${getLocalName(row.name)} = ${row.read};`);
    }
  }
  if (hoisted) {
    lines.push("const path = scope.path ?? '';");
  }
  lines.push(call);
  return {
    code: `${comment}\nexport function ${binding.name}(scope) {\n${lines.join('\n')}\n}`,
    usage,
  };
}

/** Whether an expression reads a state field, which a later initializer then reads as a local. */
function readsState(expr: Expr): boolean {
  switch (expr.kind) {
    case 'literal':
      return false;
    case 'path': {
      if (expr.root.kind === 'state') {
        return true;
      }
      for (const segment of expr.segments) {
        if (typeof segment !== 'string' && segment.kind === 'index' && readsState(segment.value)) {
          return true;
        }
      }
      return false;
    }
    case 'unary':
      return readsState(expr.arg);
    case 'binary':
    case 'logical':
      return readsState(expr.left) || readsState(expr.right);
    case 'conditional':
      return readsState(expr.test) || readsState(expr.then) || readsState(expr.else);
    case 'template':
      return expr.exprs.some(readsState);
    case 'object':
      return expr.entries.some((entry) => readsState(entry.value));
    case 'array':
      return expr.items.some(readsState);
    case 'call':
      return expr.helper === 'inlined' ? readsState(expr.body) : expr.args.some(readsState);
    case 'method':
      return readsState(expr.receiver) || expr.args.some(readsState);
    default:
      return readsState(expr.receiver);
  }
}

/** Emits the `view` chunk of a module that a parent renders: `init` and `render`. */
export function emitViewChunk(context: ChunkContext): GroupChunk {
  const { component } = context;
  const usage = createUsage();

  // The initial model, from the state initializers and the props.
  const initUsage = createUsage();
  const initEmitter = new Emitter('server', initUsage, context.report);
  let sequential = false;
  for (const field of component.state) {
    sequential = sequential || readsState(field.init);
  }
  // An initializer that reads an earlier field needs the fields as locals.
  const fields: string[] = [];
  const locals: string[] = [];
  for (const field of component.state) {
    const local = getLocalName(field.name);
    const value = initEmitter.expr(field.init, 1);
    locals.push(`const ${local} = ${value};`);
    if (sequential) {
      fields.push(local === field.name ? local : `${getKey(field.name)}: ${local}`);
    } else {
      fields.push(`${getKey(field.name)}: ${value}`);
    }
  }
  const initBody = sequential
    ? `${locals.join('\n')}\nreturn { ${fields.join(', ')} };`
    : `return ${fields.length === 0 ? '{}' : `{ ${fields.join(', ')} }`};`;
  for (const name of initUsage.modules) {
    usage.modules.add(name);
  }
  for (const name of initUsage.imports) {
    usage.imports.add(name);
  }
  for (const name of initUsage.helpers) {
    usage.helpers.add(name);
  }
  const init = `// The initial model, from the state initializers and the props.\nexport function init(${initUsage.scope.has('props') ? 'props' : ''}) {\n${initBody}\n}`;

  // The whole view, with the server's names. A child it renders is added, as in a template.
  const emitter = new Emitter('server', usage, context.report);
  const cloned = canClone(component.view, component, context.plan);
  let body: string[];
  if (cloned) {
    const clone = createCloneContext(component, context.plan, emitter);
    const built = buildBody(component.view, 'html', 'templateV$', clone);
    body = [...built.pre, `return ${built.expr};`];
  } else {
    const builder = new HtmlBuilder(context.component, context.plan, emitter);
    builder.target = 'client';
    const built = builder.build(component.view);
    body = [...built.pre, `return ${toExpression({ pre: [], parts: built.parts })};`];
  }
  const lines: string[] = [];
  if (component.state.length > 0) {
    usage.scope.add('model');
    const names: string[] = [];
    for (const field of component.state) {
      const local = getLocalName(field.name);
      names.push(local === field.name ? local : `${getKey(field.name)}: ${local}`);
    }
    lines.push(`const { ${names.join(', ')} } = model;`);
  }
  lines.push(...body);
  // A view that clones takes the document after the scope.
  let parameter = printScope(usage, true);
  if (cloned) {
    parameter = `${parameter === '' ? '$scope' : parameter}, $doc`;
  }
  const render = `// The whole view without the boundary markers, which the parent's template writes.\nexport function render(${parameter}) {\n${lines.join('\n')}\n}`;
  const chunk: Module = { chunk: 'view', code: assemble(usage, [init, render], context) };
  return { module: chunk, usage };
}
