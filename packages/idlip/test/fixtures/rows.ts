// Reads what a list chunk's `render` returns, HTML or a cloned fragment, as one canonical HTML
// string, so a test compares the nodes and not how they were made. Needs a DOM (happy-dom).
import { parseHtml } from '../../src/client/patch/dom.ts';

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'wbr']);

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function printNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escape(node.nodeValue ?? '');
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `<!--${node.nodeValue ?? ''}-->`;
  }
  if (!(node instanceof Element)) {
    return '';
  }
  // Attributes sorted by name: a clone writes them after the static ones.
  const attributes: string[] = [];
  for (const attribute of node.attributes) {
    attributes.push(` ${attribute.name}="${escape(attribute.value).replaceAll('"', '&quot;')}"`);
  }
  attributes.sort();
  const tag = node.localName;
  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attributes.join('')}>`;
  }
  let inner = '';
  for (const child of node.childNodes) {
    inner += printNode(child);
  }
  return `<${tag}${attributes.join('')}>${inner}</${tag}>`;
}

/** The parser for a chunk's `parseHtml$` import. */
export { parseHtml };

/** Prints a row without its row markers, from the HTML of a row or a fragment with markers. */
export function printRow(row: unknown): string {
  const nodes =
    row instanceof DocumentFragment ? [...row.childNodes] : parseHtml(document, String(row));
  let out = '';
  for (const node of nodes) {
    const data = node.nodeType === Node.COMMENT_NODE ? node.nodeValue : undefined;
    if (data !== 'i' && data !== '/i') {
      out += printNode(node);
    }
  }
  return out;
}
