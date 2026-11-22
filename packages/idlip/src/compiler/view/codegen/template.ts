// Cloned templates: a client body of static elements, attributes, events and text holes renders
// by cloning a `<template>` and writing the values on its marked nodes (`clone$` in
// `core/helpers.ts`). The clone holds the same nodes the HTML would parse to, markers included,
// so the patcher and the server render see no difference. Other bodies render HTML.
import type { Component, Node } from '../analyze/index.ts';
import { getMessage } from './events.ts';
import type { Emitter } from './expr.ts';
import type { Plan } from './plan.ts';
import { escapeAttribute, escapeSingleQuoted, escapeText, quote } from './text.ts';

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

/** Elements whose text the parser reads as text, not markup: no comment can mark a hole. */
const TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/** Parents where the parser moves text out of place, so a text hole there renders HTML. */
const TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select']);

/** A body that renders by a clone. */
export interface ClonedBody {
  /** The static HTML, with `i-x="<n>"` on written elements and `<!--x<n>-->` for written text. */
  html: string;
  /** The statements that write the values, on `$n[<n>]`. */
  writes: string[];
}

type Element = Extract<Node, { kind: 'element' }>;

function isClonedElement(node: Element, plan: Plan): boolean {
  if (node.html !== undefined) {
    return false;
  }
  for (const attr of node.attrs) {
    if (attr.value.kind !== 'static' && plan.dynamic.has(attr.value.hole.id)) {
      return false;
    }
  }
  for (const child of node.children) {
    if (TEXT_TAGS.has(node.tag) ? child.kind !== 'text' : !isCloned(child, node.tag, plan)) {
      return false;
    }
  }
  return true;
}

function isCloned(node: Node, parent: string, plan: Plan): boolean {
  switch (node.kind) {
    case 'text':
      return true;
    case 'text-hole':
      return !plan.dynamic.has(node.hole.id) && !TABLE_TAGS.has(parent);
    case 'element':
      return isClonedElement(node, plan);
    default:
      return false;
  }
}

class TemplateBuilder {
  html = '';
  writes: string[] = [];
  marks = 0;

  constructor(
    readonly component: Component,
    readonly plan: Plan,
    readonly emitter: Emitter,
  ) {}

  addMark(): number {
    this.marks++;
    return this.marks;
  }

  add(node: Node): void {
    const { emitter } = this;
    if (node.kind === 'text') {
      this.html += escapeText(node.value);
    } else if (node.kind === 'text-hole') {
      emitter.at = node.hole.span;
      emitter.usage.helpers.add('putText');
      const mark = this.addMark();
      this.writes.push(`putText$($n[${mark}], ${emitter.expr(node.hole.expr, 1)});`);
      const placeholder = `<!--x${mark}-->`;
      const id = node.hole.id;
      this.html += this.plan.bound.has(id) ? `<!--t${id}-->${placeholder}<!--/t-->` : placeholder;
    } else if (node.kind === 'element') {
      this.addElement(node);
    }
  }

  addElement(node: Element): void {
    const { emitter } = this;
    this.html += `<${node.tag}`;
    // The mark goes after the tag name once the element has its first write.
    const at = this.html.length;
    let mark = 0;
    const write = (print: (target: string) => string): void => {
      if (mark === 0) {
        mark = this.addMark();
        this.html = `${this.html.slice(0, at)} i-x="${mark}"${this.html.slice(at)}`;
      }
      this.writes.push(print(`$n[${mark}]`));
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
      const message = getMessage(this.component, event, emitter);
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
    const ids = this.plan.anchors.get(node);
    if (ids !== undefined) {
      this.html += ` i-a="${ids.join(' ')}"`;
    }
    this.html += '>';
    if (VOID_TAGS.has(node.tag)) {
      return;
    }
    // The parser drops a newline that starts a textarea.
    if (node.tag === 'textarea' && node.children.length > 0) {
      this.html += '\n';
    }
    for (const child of node.children) {
      if (child.kind === 'text' && (node.tag === 'script' || node.tag === 'style')) {
        this.html += child.value;
      } else {
        this.add(child);
      }
    }
    this.html += `</${node.tag}>`;
  }
}

/** Tells whether a node writes a value on a clone: a hole, a bound attribute, event or ref. */
function hasWrite(node: Node): boolean {
  if (node.kind === 'text-hole') {
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
  if (node.events.length > 0) {
    // An event message is static unless it reads a value, which only `getMessage` tells, so
    // an element with events counts as one that writes.
    return true;
  }
  for (const child of node.children) {
    if (hasWrite(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Tells whether a client body renders by a clone: it has nodes, sits in HTML, holds only
 * elements, static text and text holes, and writes at least one value. A static body renders
 * HTML: its parse is short, and the copied `clone$` would cost more bytes than it saves. A
 * child, a list, a condition, `<Try>`, `<Subscribe>`, `<Head>`, a global listener, raw HTML, a
 * dynamic hole and a hole in a text element or a table render HTML.
 */
export function canClone(nodes: readonly Node[], namespace: string, plan: Plan): boolean {
  if (nodes.length === 0 || namespace !== 'html') {
    return false;
  }
  let writes = false;
  for (const node of nodes) {
    if (!isCloned(node, '', plan)) {
      return false;
    }
    writes ||= hasWrite(node);
  }
  return writes;
}

/** Builds the template and writes of a body that `canClone` accepts. */
export function buildClone(
  nodes: readonly Node[],
  component: Component,
  plan: Plan,
  emitter: Emitter,
): ClonedBody {
  const builder = new TemplateBuilder(component, plan, emitter);
  for (const node of nodes) {
    builder.add(node);
  }
  emitter.usage.helpers.add('clone');
  return { html: builder.html, writes: builder.writes };
}

/** Prints the statements of a render that clones `name` and returns the fragment. */
export function printClone(name: string, body: ClonedBody): string[] {
  return [`const $n = clone$(${name});`, ...body.writes, 'return $n[0];'];
}
