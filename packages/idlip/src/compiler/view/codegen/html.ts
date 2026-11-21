// Turns view nodes into JS that builds their markup: the server render and client templates.
import type { Component, Node } from '../analyze/index.ts';
import { addChildNode } from './child.ts';
import { getMessage } from './events.ts';
import type { Emitter } from './expr.ts';
import type { Plan } from './plan.ts';
import {
  escapeAttribute,
  escapeSingleQuoted,
  escapeText,
  getLocalName,
  joinParts,
  quote,
} from './text.ts';
import type { Part } from './text.ts';

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

const RAW_TEXT_TAGS = new Set(['script', 'style']);
/** `raw` text is not escaped. `rcdata` text is escaped but holds no comment markers. */
type Content = 'html' | 'raw' | 'rcdata';

const ESCAPABLE_RAW_TEXT_TAGS = new Set(['textarea', 'title']);

/** Markup as parts, with the statements it needs before the expression that holds it. */
export interface Built {
  pre: string[];
  parts: Part[];
}

export function createBuilt(): Built {
  return { pre: [], parts: [] };
}

/** Prints a block of statements and an expression as one expression. */
export function toExpression(built: Built): string {
  const expression = joinParts(built.parts);
  if (built.pre.length === 0) {
    return expression;
  }
  return `(() => {\n${built.pre.join('\n')}\nreturn ${expression};\n})()`;
}

function addText(built: Built, value: string): void {
  built.parts.push({ kind: 'text', value });
}

function addCode(built: Built, value: string): void {
  built.parts.push({ kind: 'code', value });
}

export class HtmlBuilder {
  /** Variable names in use for list rows. */
  accumulators: Set<string> = new Set();

  /**
   * Where the markup runs. A child is called as a module on the server, and added with
   * `addChild` in a client template. The view chunk prints with the server's names and
   * adds children as a template does.
   */
  target: 'server' | 'client';

  constructor(
    readonly component: Component,
    readonly plan: Plan,
    readonly emitter: Emitter,
  ) {
    this.target = emitter.mode;
  }

  build(nodes: Node[], content: Content = 'html'): Built {
    const built = createBuilt();
    for (const node of nodes) {
      this.add(node, built, content);
    }
    return built;
  }

  pickAccumulator(): string {
    // A leading `$` without a trailing one is a form `getLocalName` never returns.
    let name = '$rows';
    for (let count = 2; this.accumulators.has(name); count++) {
      name = `$rows${count}`;
    }
    this.accumulators.add(name);
    return name;
  }

  add(node: Node, built: Built, content: Content): void {
    const { emitter } = this;
    switch (node.kind) {
      case 'text':
        addText(built, content === 'raw' ? node.value : escapeText(node.value));
        break;
      case 'text-hole': {
        emitter.at = node.hole.span;
        emitter.usage.helpers.add('text');
        const value = `text$(${emitter.expr(node.hole.expr, 1)})`;
        // A raw text element cannot hold the comment markers.
        if (this.plan.bound.has(node.hole.id) && content === 'html') {
          addText(built, `<!--t${node.hole.id}-->`);
          addCode(built, value);
          addText(built, '<!--/t-->');
        } else {
          if (this.plan.bound.has(node.hole.id)) {
            emitter.report(
              'codegen-raw-text',
              'A hole in a textarea or title is not patched',
              node.hole.span,
            );
          }
          addCode(built, value);
        }
        break;
      }
      case 'element':
        this.addElement(node, built);
        break;
      case 'for':
        this.addList(node, built);
        break;
      case 'condition':
        this.addCondition(node, built);
        break;
      case 'child':
        addChildNode(this, node, built);
        break;
      case 'global':
        addText(built, `<template i-global="${node.target}"`);
        this.addEvents(node.events, built);
        this.addAnchor(node, built);
        addText(built, '></template>');
        break;
      default:
        // `plan` reports the unsupported node.
        break;
    }
  }

  addEvents(events: Extract<Node, { kind: 'element' }>['events'], built: Built): void {
    const { emitter } = this;
    for (const event of events) {
      if (event.target.kind !== 'handler' && event.target.kind !== 'prop') {
        continue;
      }
      emitter.at = event.span;
      const message = getMessage(this.component, event, emitter);
      if (message.json === undefined) {
        emitter.usage.helpers.add('on');
        addCode(built, `on$(${quote(event.name)}, ${message.code})`);
      } else {
        addText(built, ` on:${event.name}='${escapeSingleQuoted(message.json)}'`);
      }
    }
  }

  /** Writes `i-ref="name"`, or `i-ref="name key"` for a row. The key never patches. */
  addRef(node: Extract<Node, { kind: 'element' }>, built: Built): void {
    const { ref } = node;
    if (ref === undefined) {
      return;
    }
    if (ref.kind === 'name') {
      addText(built, ` i-ref="${escapeAttribute(ref.name)}"`);
      return;
    }
    this.emitter.at = node.span;
    this.emitter.usage.helpers.add('attr');
    addCode(built, `attr$('i-ref', ${quote(`${ref.name} `)} + ${this.emitter.expr(ref.key, 14)})`);
  }

  addAnchor(node: Node, built: Built): void {
    const ids = this.plan.anchors.get(node);
    if (ids !== undefined) {
      addText(built, ` i-a="${ids.join(' ')}"`);
    }
  }

  addElement(node: Extract<Node, { kind: 'element' }>, built: Built): void {
    const { emitter } = this;
    addText(built, `<${node.tag}`);
    // Attributes in source order, then events, then the anchor.
    for (const attr of node.attrs) {
      if (attr.value.kind === 'static') {
        addText(
          built,
          attr.value.value === true
            ? ` ${attr.name}`
            : ` ${attr.name}="${escapeAttribute(attr.value.value)}"`,
        );
      } else {
        emitter.at = attr.value.hole.span;
        emitter.usage.helpers.add('attr');
        addCode(built, `attr$(${quote(attr.name)}, ${emitter.expr(attr.value.hole.expr, 1)})`);
      }
    }
    this.addEvents(node.events, built);
    this.addRef(node, built);
    this.addAnchor(node, built);
    addText(built, '>');
    if (VOID_TAGS.has(node.tag)) {
      return;
    }
    // The parser drops a newline that starts a textarea.
    if (node.tag === 'textarea' && node.children.length > 0) {
      addText(built, '\n');
    }
    let content: Content = 'html';
    if (RAW_TEXT_TAGS.has(node.tag)) {
      content = 'raw';
    } else if (ESCAPABLE_RAW_TEXT_TAGS.has(node.tag)) {
      content = 'rcdata';
    }
    for (const child of node.children) {
      this.add(child, built, content);
    }
    addText(built, `</${node.tag}>`);
  }

  addList(node: Extract<Node, { kind: 'for' }>, built: Built): void {
    const { emitter } = this;
    const accumulator = this.pickAccumulator();
    emitter.at = node.each.span;
    // Loop variables stay variables, also in a client template.
    const each = emitter.expr(node.each.expr, node.index === undefined ? 1 : 17);
    emitter.frames.push({ item: node.item, index: node.index, row: undefined });
    const row = this.build(node.body);
    emitter.frames.pop();
    const item = getLocalName(node.item);
    const binding = node.index === undefined ? item : `[${getLocalName(node.index)}, ${item}]`;
    const source = node.index === undefined ? each : `${each}.entries()`;
    const body = joinParts([
      { kind: 'text', value: '<!--i-->' },
      ...row.parts,
      { kind: 'text', value: '<!--/i-->' },
    ]);
    built.pre.push(
      `let ${accumulator} = '';`,
      `for (const ${binding} of ${source}) {`,
      ...row.pre,
      `${accumulator} += ${body};`,
      '}',
    );
    addText(built, `<!--l${node.each.id}-->`);
    addCode(built, accumulator);
    addText(built, '<!--/l-->');
  }

  /** Prints one branch of a condition as an expression, without markers. */
  buildBranch(nodes: Node[]): Built {
    return this.build(nodes);
  }

  addCondition(node: Extract<Node, { kind: 'condition' }>, built: Built): void {
    const { emitter } = this;
    emitter.at = node.test.span;
    const test = emitter.expr(node.test.expr, 2);
    const bound = this.plan.bound.has(node.test.id);
    const branches: string[] = [];
    for (const [branch, nodes] of [node.then, node.else].entries()) {
      const inner = this.build(nodes);
      const parts: Part[] = bound
        ? [
            { kind: 'text', value: `<!--c${node.test.id}:${branch}-->` },
            ...inner.parts,
            { kind: 'text', value: '<!--/c-->' },
          ]
        : inner.parts;
      branches.push(toExpression({ pre: inner.pre, parts }));
    }
    addCode(built, `(${test} ? ${branches[0]} : ${branches[1]})`);
  }
}
