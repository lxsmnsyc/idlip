// oxlint-disable import/prefer-default-export
// Emits the bindings of the elements in a `<Head>`. The marker in the body is the binding's
// node. The element itself is in `<head>`, found by the marker's `i-head` number.
import type { Emitter } from './expr.ts';
import type { Binding } from './plan.ts';
import { joinParts, quote } from './text.ts';
import type { Part } from './text.ts';

type HeadSource = Extract<Binding['source'], { kind: 'head-attr' | 'head-title' }>;

/** Prints the body of a head binding. `el` is the marker. */
export function emitHeadBody(source: HeadSource, emitter: Emitter): string {
  const { usage } = emitter;
  const find = `el.ownerDocument.querySelector(\`[i-head="\${el.getAttribute('i-head')}.${source.index}"]\`)`;
  if (source.kind === 'head-attr') {
    emitter.at = source.hole.span;
    usage.helpers.add('setAttr');
    const value = emitter.expr(source.hole.expr, 1);
    return `setAttr$(${find}, ${quote(source.name)}, ${value});`;
  }
  // The loader's watch of `<head>` moves the new title to `document.title`.
  usage.helpers.add('getText');
  const parts: Part[] = [];
  for (const child of source.children) {
    if (child.kind === 'text') {
      parts.push({ kind: 'text', value: child.value });
    } else if (child.kind === 'text-hole') {
      emitter.at = child.hole.span;
      parts.push({ kind: 'code', value: `getText$(${emitter.expr(child.hole.expr, 1)})` });
    }
  }
  return `${find}.textContent = ${joinParts(parts)};`;
}
