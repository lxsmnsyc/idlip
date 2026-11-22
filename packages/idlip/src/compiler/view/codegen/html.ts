// Turns view nodes into JS that builds their markup: the server render. Client chunks clone
// templates instead (`template.ts`).
import type { Component, Node } from '../analyze/index.ts';
import { addChildNode } from './child.ts';
import { printTracked } from './dynamic.ts';
import { getMessage, printModifiers } from './events.ts';
import type { Emitter } from './expr.ts';
import type { HeadNode, Plan } from './plan.ts';
import { addRawHtml } from './raw.ts';
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
  /** Set while a server render writes a head element: the variable of its block and its index. */
  headMark: { variable: string; index: number } | undefined;

  /** Variable names in use for list rows. */
  accumulators: Set<string> = new Set();

  /** The ids of the `<Try>` regions whose catch view is being built, innermost last. */
  catching: number[] = [];

  constructor(
    readonly component: Component,
    readonly plan: Plan,
    readonly emitter: Emitter,
  ) {}

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
        const { id } = node.hole;
        const filled = this.plan.filled.has(id);
        const inner = this.plan.dynamic.has(id)
          ? printTracked(emitter, this.component, node.hole, `${filled ? 'a' : 't'}${id}`)
          : emitter.expr(node.hole.expr, 1);
        const value = `text$(${inner})`;
        // A raw text element cannot hold the comment markers, and the only child of an element
        // is found through the element's `i-a`.
        if (filled) {
          addCode(built, value);
        } else if (this.plan.bound.has(id) && content === 'html') {
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
      case 'subscribe':
        this.addSubscribe(node, built);
        break;
      case 'try':
        this.addTry(node, built);
        break;
      case 'head':
        this.addHead(node, built);
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

  /**
   * Writes the marker of a `<Subscribe>` between its own block comments, so the block hooks
   * start and stop it. `:s` tells the loader it is not a condition.
   */
  addSubscribe(node: Extract<Node, { kind: 'subscribe' }>, built: Built): void {
    const { emitter } = this;
    const id = this.plan.subs.get(node);
    if (node.source.kind !== 'import' && node.source.kind !== 'module') {
      return;
    }
    addText(built, `<!--c${id}:s--><template i-sub="${node.source.name}"`);
    for (const [name, hole] of [
      ['i-input', node.input],
      ['i-key', node.key],
    ] as const) {
      if (hole !== undefined) {
        emitter.at = hole.span;
        emitter.usage.helpers.add('attr');
        addCode(built, `attr$(${quote(name)}, JSON.stringify(${emitter.expr(hole.expr, 0)}))`);
      }
    }
    this.addEvents(node.events, built);
    this.addAnchor(node, built);
    addText(built, '></template><!--/c-->');
  }

  /**
   * Writes a `<Try>` region: `<!--e<id>:0-->` around the body, or `<!--e<id>:1-->` around the
   * catch view when something in the body throws. The code runs the body in a `try` block, so
   * a throwing hole, helper or child leaves no half-written markup.
   */
  addTry(node: Extract<Node, { kind: 'try' }>, built: Built): void {
    const id = this.plan.tryIds.get(node);
    if (id === undefined) {
      return;
    }
    const variable = `$try${id}`;
    const body = this.build(node.body);
    const catchBuilt = this.buildCatch(node, id);
    const error = getLocalName(node.error);
    const wrap = (state: number, parts: Part[]): string =>
      joinParts([
        { kind: 'text', value: `<!--e${id}:${state}-->` },
        ...parts,
        { kind: 'text', value: '<!--/e-->' },
      ]);
    // A body that throws after a `<Head>` or a child wrote its head output drops that output.
    const marked = this.plan.heads.size > 0 || this.plan.uses.length > 0;
    built.pre.push(
      `let ${variable};`,
      ...(marked ? [`const $mark${id} = context.headMark?.() ?? 0;`] : []),
      'try {',
      ...body.pre,
      `${variable} = ${wrap(0, body.parts)};`,
      '} catch ($e) {',
      ...(marked ? [`context.headRollback?.($mark${id});`] : []),
      `const ${error} = $e instanceof Error ? $e.name + ': ' + $e.message : String($e);`,
      ...catchBuilt.pre,
      `${variable} = ${wrap(1, catchBuilt.parts)};`,
      '}',
    );
    addCode(built, variable);
  }

  /** Builds the catch view of a region. A `reset` event in it names the region. */
  buildCatch(node: Extract<Node, { kind: 'try' }>, id: number): Built {
    this.catching.push(id);
    const built = this.build(node.catch);
    this.catching.pop();
    return built;
  }

  /**
   * Writes the marker block of a `<Head>`. The server writes the elements through `context`,
   * each with `i-head="<id>.<index>"`, and the marker stays empty. A client template holds the
   * elements in the marker, and the loader moves them to `<head>` (`template.ts`).
   */
  addHead(node: HeadNode, built: Built): void {
    const id = this.plan.heads.get(node);
    const elements: Extract<Node, { kind: 'element' }>[] = [];
    for (const child of node.children) {
      if (child.kind === 'element') {
        elements.push(child);
      }
    }
    const variable = `$head${id}`;
    built.pre.push(`const ${variable} = context.headId?.() ?? 0;`);
    const rest = createBuilt();
    const title = createBuilt();
    for (const [index, element] of elements.entries()) {
      this.headMark = { variable, index };
      this.addElement(element, element.tag === 'title' ? title : rest);
    }
    this.headMark = undefined;
    built.pre.push(...rest.pre, ...title.pre);
    const titleArgument = title.parts.length === 0 ? '' : `, ${joinParts(title.parts)}`;
    addText(built, `<!--c${id}:h--><template i-head="`);
    addCode(built, variable);
    addText(built, '"');
    this.addAnchor(node, built);
    addText(built, '></template><!--/c-->');
    addCode(built, `(context.head?.(${variable}, ${joinParts(rest.parts)}${titleArgument}), '')`);
  }

  addEvents(events: Extract<Node, { kind: 'element' }>['events'], built: Built): void {
    const { emitter } = this;
    for (const event of events) {
      const region = this.catching.at(-1);
      if (event.target.kind === 'reset' && region !== undefined) {
        // The loader handles the reserved tag `$reset` itself: it renders the region again.
        const modifiers = printModifiers(event);
        const message = modifiers === '' ? ['$reset', [region]] : ['$reset', [region], modifiers];
        addText(built, ` on:${event.name}='${JSON.stringify(message)}'`);
        continue;
      }
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
        const { hole } = attr.value;
        let value = this.plan.dynamic.has(hole.id)
          ? printTracked(emitter, this.component, hole, `a${hole.id}`)
          : emitter.expr(hole.expr, 1);
        if (attr.url !== undefined) {
          emitter.usage.helpers.add('safeUrl');
          value = `safeUrl$(${value}, ${quote(attr.name)}${attr.url === 'embed' ? ', true' : ''})`;
        }
        addCode(built, `attr$(${quote(attr.name)}, ${value})`);
      }
    }
    this.addEvents(node.events, built);
    this.addRef(node, built);
    if (this.headMark === undefined) {
      this.addAnchor(node, built);
    } else {
      addText(built, ' i-head="');
      addCode(built, this.headMark.variable);
      addText(built, `.${this.headMark.index}"`);
    }
    addText(built, '>');
    if (VOID_TAGS.has(node.tag)) {
      return;
    }
    if (node.html !== undefined) {
      addRawHtml(emitter, node, built);
      addText(built, `</${node.tag}>`);
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
