// Raw HTML: the server writes the value of `html={trusted(value)}` as the element's content,
// and the client binding replaces the content through the loader's `parseHtml`, which holds
// the one Trusted Types policy. The analysis lets only `trusted(...)` reach a hole here.
import type { Node } from '../analyze/index.ts';
import type { Emitter } from './expr.ts';
import type { Built } from './html.ts';
import type { Source } from './plan.ts';
import { quote } from './text.ts';

type ElementNode = Extract<Node, { kind: 'element' }>;

/** The namespace the content of an element is parsed in, or `undefined` for HTML. */
export function getContentNamespace(node: ElementNode): string | undefined {
  // `foreignObject` is in the SVG namespace and its content is HTML.
  if (node.tag === 'foreignObject' || node.namespace === 'html') {
    return undefined;
  }
  return node.namespace;
}

/** Writes the trusted value as is, as the content of the element. */
export function addRawHtml(emitter: Emitter, node: ElementNode, built: Built): void {
  if (node.html === undefined) {
    return;
  }
  emitter.at = node.html.span;
  built.parts.push({ kind: 'code', value: `(${emitter.expr(node.html.expr, 0)}) ?? ''` });
}

/** Prints the body of the binding of an `html` prop: it replaces the content of the element. */
export function printHtmlBody(source: Extract<Source, { kind: 'html' }>, emitter: Emitter): string {
  emitter.at = source.hole.span;
  emitter.usage.loader.add('parseHtml');
  const value = `(${emitter.expr(source.hole.expr, 0)}) ?? ''`;
  const namespace = getContentNamespace(source.node);
  const ns = namespace === undefined ? '' : `, ${quote(namespace)}`;
  return `el.replaceChildren(...parseHtml(el.ownerDocument, ${value}${ns}));`;
}
