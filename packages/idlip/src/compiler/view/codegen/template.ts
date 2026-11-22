// Cloned templates: a client body renders by cloning a parsed template and writing the values
// on its marked nodes (`clone$` in `core/helpers.ts`). The clone holds the same nodes the HTML
// would parse to, markers included, so the patcher and the server render see no difference. A
// block inside a body (a condition or a list) is a marked comment in the template, and the
// body's writes clone the block's own templates next to it. Other bodies render HTML.
import type { Component, Node } from '../analyze/index.ts';
import { printProps, printSlot } from './child.ts';
import { getMessage, isFixedMessage } from './events.ts';
import type { Emitter } from './expr.ts';
import type { Plan } from './plan.ts';
import { escapeAttribute, escapeSingleQuoted, escapeText, getLocalName, quote } from './text.ts';

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/**
 * HTML elements whose text the parser reads as text, not markup: no comment can mark a hole, so
 * a write sets the element's whole text. The compiler rejects a hole in a `script` or a `style`.
 */
const TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/** HTML elements whose parser drops a newline right after the start tag. */
const NEWLINE_TAGS = new Set(['pre', 'listing', 'textarea']);

/**
 * Parents where the parser moves text out of a table or a select, so a text hole there renders
 * HTML.
 */
const TEXT_PARENT_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select']);

type Element = Extract<Node, { kind: 'element' }>;

/** What the builders of one render function share. */
export interface CloneContext {
  readonly component: Component;
  readonly plan: Plan;
  readonly emitter: Emitter;
  /** The number of fragment variables (`$n`, `$n2`, ...) the function declared. */
  variables: number;
}

/** Makes the context of one render function. */
export function createCloneContext(
  component: Component,
  plan: Plan,
  emitter: Emitter,
): CloneContext {
  return { component, plan, emitter, variables: 0 };
}

/** The code that builds a body: statements, then an expression of its fragment. */
export interface BodyCode {
  pre: string[];
  expr: string;
  /** Whether the body holds a block that the block hooks must see once it is in the page. */
  blocks: boolean;
}

function isClonedElement(node: Element, component: Component, plan: Plan): boolean {
  // The walk of `clone$` does not enter the content of a nested `<template>`.
  if (node.html !== undefined || (node.tag === 'template' && hasWrite(node, component))) {
    return false;
  }
  for (const attr of node.attrs) {
    if (attr.value.kind !== 'static' && plan.dynamic.has(attr.value.hole.id)) {
      return false;
    }
  }
  // In SVG and MathML a `title` or a `style` is an element like any other.
  const text = node.namespace === 'html' && TEXT_TAGS.has(node.tag);
  for (const child of node.children) {
    if (
      text
        ? child.kind !== 'text' && (child.kind !== 'text-hole' || plan.dynamic.has(child.hole.id))
        : !isCloned(child, node.tag, component, plan)
    ) {
      return false;
    }
  }
  return true;
}

function isClonedBody(nodes: readonly Node[], component: Component, plan: Plan): boolean {
  for (const node of nodes) {
    if (!isCloned(node, '', component, plan)) {
      return false;
    }
  }
  return true;
}

function isCloned(node: Node, parent: string, component: Component, plan: Plan): boolean {
  switch (node.kind) {
    case 'text':
      return true;
    case 'text-hole':
      return !plan.dynamic.has(node.hole.id) && !TEXT_PARENT_TAGS.has(parent);
    case 'element':
      return isClonedElement(node, component, plan);
    case 'condition':
      return isClonedBody(node.then, component, plan) && isClonedBody(node.else, component, plan);
    case 'for':
      return isClonedBody(node.body, component, plan);
    case 'child':
      return true;
    default:
      return false;
  }
}

class TemplateBuilder {
  html = '';
  writes: string[] = [];
  marks = 0;
  blocks = false;

  constructor(
    readonly context: CloneContext,
    /** The variable that holds the fragment and the marked nodes. */
    readonly variable: string,
  ) {}

  addMark(): number {
    this.marks++;
    return this.marks;
  }

  add(node: Node, parent: string): void {
    const { emitter } = this.context;
    if (node.kind === 'text') {
      this.html += escapeText(node.value);
    } else if (node.kind === 'text-hole') {
      emitter.at = node.hole.span;
      emitter.usage.helpers.add('putText');
      const mark = this.addMark();
      this.writes.push(`putText$(${this.variable}[${mark}], ${emitter.expr(node.hole.expr, 1)});`);
      const placeholder = `<!--x${mark}-->`;
      const id = node.hole.id;
      this.html += this.context.plan.bound.has(id)
        ? `<!--t${id}-->${placeholder}<!--/t-->`
        : placeholder;
    } else if (node.kind === 'element') {
      this.addElement(node);
    } else if (node.kind === 'condition') {
      this.addCondition(node);
    } else if (node.kind === 'for') {
      this.addList(node);
    } else if (node.kind === 'child') {
      this.addChild(node);
    } else {
      throw new Error(`A ${node.kind} node does not clone (parent ${parent})`);
    }
  }

  /**
   * A bound condition is `<!--c<id>:x<n>--><!--/c-->`: the write appends the branch number to
   * the start comment and puts the branch after it. An unbound one has no markers, so its
   * branch replaces a placeholder.
   */
  addCondition(node: Extract<Node, { kind: 'condition' }>): void {
    const { context } = this;
    const { emitter } = context;
    const id = node.test.id;
    const bound = context.plan.bound.has(id);
    const mark = this.addMark();
    const target = `${this.variable}[${mark}]`;
    this.html += bound ? `<!--c${id}:x${mark}--><!--/c-->` : `<!--x${mark}-->`;
    this.blocks ||= bound;
    emitter.at = node.test.span;
    const test = emitter.expr(node.test.expr, 0);
    const branches: string[][] = [];
    for (const [branch, nodes] of [node.then, node.else].entries()) {
      const lines = bound ? [`${target}.data += ${branch};`] : [];
      if (nodes.length === 0) {
        if (!bound) {
          lines.push(`${target}.remove();`);
        }
      } else {
        const body = buildBody(nodes, node.namespace, `templateC${id}_${branch}$`, context);
        this.blocks ||= body.blocks;
        lines.push(
          ...body.pre,
          bound ? `${target}.after(${body.expr});` : `${target}.replaceWith(${body.expr});`,
        );
      }
      branches.push(lines);
    }
    this.writes.push(`if (${test}) {`, ...branches[0], '} else {', ...branches[1], '}');
  }

  /** A list is `<!--l<id>--><!--/lx<n>-->`: each row is cloned and put before the end comment. */
  addList(node: Extract<Node, { kind: 'for' }>): void {
    const { context } = this;
    const { emitter } = context;
    const id = node.each.id;
    const mark = this.addMark();
    this.html += `<!--l${id}--><!--/lx${mark}-->`;
    this.blocks = true;
    emitter.at = node.each.span;
    // Loop variables stay variables, as in the server render.
    const each = emitter.expr(node.each.expr, node.index === undefined ? 1 : 17);
    emitter.frames.push({ item: node.item, index: node.index, row: undefined });
    const body = buildBody(node.body, node.namespace, `templateL${id}$`, context, true);
    emitter.frames.pop();
    const item = getLocalName(node.item);
    const binding = node.index === undefined ? item : `[${getLocalName(node.index)}, ${item}]`;
    const source = node.index === undefined ? each : `${each}.entries()`;
    this.writes.push(
      `for (const ${binding} of ${source}) {`,
      ...body.pre,
      `${this.variable}[${mark}].before(${body.expr});`,
      '}',
    );
  }

  /**
   * A child is `<!--n:x<n>--><!--/n-->`: the write appends the slot path to the start comment and
   * puts the nodes `addChild` returns after it.
   */
  addChild(node: Extract<Node, { kind: 'child' }>): void {
    const { component, emitter, plan } = this.context;
    const root = node.component;
    const used = plan.uses.find(
      (item) => (root.kind === 'import' || root.kind === 'module') && item.name === root.name,
    );
    if (used === undefined || !plan.children.has(node)) {
      // `plan` reports a child that is neither an import nor a component of this file.
      return;
    }
    const mark = this.addMark();
    const target = `${this.variable}[${mark}]`;
    const path = `${this.variable}p${mark}`;
    this.html += `<!--n:x${mark}--><!--/n-->`;
    this.blocks = true;
    const { usage } = emitter;
    usage.path = true;
    usage.loader.add('addChild');
    usage.views.set(used.name, used.view);
    const slot = printSlot(emitter, plan, node, 'path');
    const props = printProps({ component, emitter }, node, 'path');
    this.writes.push(
      `const ${path} = ${slot};`,
      `${target}.data += ${path};`,
      `${target}.after(addChild(${path}, ${quote(used.module)}, ${used.name}, ${props}, $doc));`,
    );
  }

  addElement(node: Element): void {
    const { emitter, component, plan } = this.context;
    this.html += `<${node.tag}`;
    // The mark goes after the tag name once the element has its first write.
    const at = this.html.length;
    let mark = 0;
    const write = (print: (target: string) => string): void => {
      if (mark === 0) {
        mark = this.addMark();
        this.html = `${this.html.slice(0, at)} i-x="${mark}"${this.html.slice(at)}`;
      }
      this.writes.push(print(`${this.variable}[${mark}]`));
    };
    for (const attr of node.attrs) {
      if (attr.value.kind === 'static') {
        this.html +=
          attr.value.value === true
            ? ` ${attr.name}`
            : ` ${attr.name}="${escapeAttribute(attr.value.value)}"`;
        continue;
      }
      emitter.at = attr.value.hole.span;
      emitter.usage.helpers.add('putAttr');
      let value = emitter.expr(attr.value.hole.expr, 1);
      if (attr.url !== undefined) {
        emitter.usage.helpers.add('safeUrl');
        value = `safeUrl$(${value}, ${quote(attr.name)}${attr.url === 'embed' ? ', true' : ''})`;
      }
      write((target) => `putAttr$(${target}, ${quote(attr.name)}, ${value});`);
    }
    for (const event of node.events) {
      if (event.target.kind !== 'handler' && event.target.kind !== 'prop') {
        continue;
      }
      const message = getMessage(component, event, emitter);
      if (message.json === undefined) {
        emitter.usage.helpers.add('setOn');
        write((target) => `setOn$(${target}, ${quote(event.name)}, ${message.code});`);
      } else {
        this.html += ` on:${event.name}='${escapeSingleQuoted(message.json)}'`;
      }
    }
    const { ref } = node;
    if (ref?.kind === 'name') {
      this.html += ` i-ref="${escapeAttribute(ref.name)}"`;
    } else if (ref !== undefined) {
      emitter.at = node.span;
      emitter.usage.helpers.add('putAttr');
      const key = emitter.expr(ref.key, 14);
      write((target) => `putAttr$(${target}, 'i-ref', ${quote(`${ref.name} `)} + ${key});`);
    }
    const ids = plan.anchors.get(node);
    if (ids !== undefined) {
      this.html += ` i-a="${ids.join(' ')}"`;
    }
    this.html += '>';
    if (VOID_TAGS.has(node.tag)) {
      return;
    }
    const html = node.namespace === 'html';
    // The parser drops a newline that starts a textarea or a `pre`, so the server and the
    // template write one, and the text after it stays as it is.
    if (html && NEWLINE_TAGS.has(node.tag) && node.children.length > 0) {
      this.html += '\n';
    }
    if (html && TEXT_TAGS.has(node.tag) && hasTextHole(node.children)) {
      // The whole text goes after what the parser kept of the template's text, which is the
      // newline of a textarea for a parser that keeps it, as it keeps the server's.
      const value = this.printText(node.children);
      write((target) => `${target}.textContent += ${value};`);
      this.html += `</${node.tag}>`;
      return;
    }
    for (const child of node.children) {
      if (child.kind === 'text' && (node.tag === 'script' || node.tag === 'style')) {
        this.html += child.value;
      } else {
        this.add(child, node.tag);
      }
    }
    this.html += `</${node.tag}>`;
  }

  /** Prints the text of static parts and holes as one string expression. */
  printText(nodes: readonly Node[]): string {
    const { emitter } = this.context;
    const parts: string[] = [];
    for (const child of nodes) {
      if (child.kind === 'text') {
        parts.push(quote(child.value));
      } else if (child.kind === 'text-hole') {
        emitter.at = child.hole.span;
        emitter.usage.helpers.add('getText');
        parts.push(`getText$(${emitter.expr(child.hole.expr, 0)})`);
      }
    }
    return parts.length === 0 ? "''" : parts.join(' + ');
  }
}

function hasTextHole(nodes: readonly Node[]): boolean {
  for (const node of nodes) {
    if (node.kind === 'text-hole') {
      return true;
    }
  }
  return false;
}

/**
 * Tells whether a node writes a value on a clone: a hole, a bound attribute, a ref with a key,
 * an event message that reads a value, or a block.
 */
function hasWrite(node: Node, component: Component): boolean {
  if (
    node.kind === 'text-hole' ||
    node.kind === 'condition' ||
    node.kind === 'for' ||
    node.kind === 'child'
  ) {
    return true;
  }
  if (node.kind !== 'element') {
    return false;
  }
  for (const attr of node.attrs) {
    if (attr.value.kind !== 'static') {
      return true;
    }
  }
  if (node.ref !== undefined && node.ref.kind !== 'name') {
    return true;
  }
  for (const event of node.events) {
    if (!isFixedMessage(component, event)) {
      return true;
    }
  }
  for (const child of node.children) {
    if (hasWrite(child, component)) {
      return true;
    }
  }
  return false;
}

/**
 * Tells whether a client body renders by a clone: it has nodes, holds only elements, static
 * text, text holes, children, and conditions and lists whose bodies clone, and writes at least
 * one value. A body in SVG or MathML parses its template in an `<svg>` or `<math>` wrapper. A
 * static body renders HTML: its parse is short. `<Try>`, `<Subscribe>`, `<Head>`, a global
 * listener, raw HTML, a dynamic hole, a write inside a `<template>`, and a text hole in a table
 * or a select render HTML. A text hole in an HTML text element sets the element's text.
 */
export function canClone(nodes: readonly Node[], component: Component, plan: Plan): boolean {
  if (nodes.length === 0 || !isClonedBody(nodes, component, plan)) {
    return false;
  }
  for (const node of nodes) {
    if (hasWrite(node, component)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the code of a body that `canClone` accepts: the module-level template `name` (added
 * to the emitter's usage) and the statements that clone it in `$doc` and write the values.
 * `row` wraps the template in the row markers.
 */
export function buildBody(
  nodes: readonly Node[],
  namespace: string,
  name: string,
  context: CloneContext,
  row = false,
): BodyCode {
  const { usage } = context.emitter;
  context.variables++;
  const variable = context.variables === 1 ? '$n' : `$n${context.variables}`;
  const builder = new TemplateBuilder(context, variable);
  for (const node of nodes) {
    builder.add(node, '');
  }
  const html = row ? `<!--i-->${builder.html}<!--/i-->` : builder.html;
  const namespaceField = namespace === 'html' ? '' : `, s: ${quote(namespace)}`;
  usage.templates.set(
    name,
    `const ${name} = { h: ${quote(html)}, n: ${builder.marks}${namespaceField} };`,
  );
  usage.helpers.add('clone');
  if (builder.writes.length === 0) {
    return { pre: [], expr: `clone$(${name}, $doc)[0]`, blocks: builder.blocks };
  }
  return {
    pre: [`const ${variable} = clone$(${name}, $doc);`, ...builder.writes],
    expr: `${variable}[0]`,
    blocks: builder.blocks,
  };
}
