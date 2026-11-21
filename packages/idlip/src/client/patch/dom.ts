import type { DomMessage } from '../../core/format.ts';
import { addBlock, findInnerBlocks, removeBlock } from './blocks.ts';
import { isComment, isRecord, matchMarker } from './guards.ts';
import { clearNodes } from './nodes.ts';

type Namespace = 'svg' | 'mathml';

function formatText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  return String(value);
}

function joinClass(value: object): string {
  const names: string[] = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

/**
 * Sets the text between `start` and its end comment. A `<textarea>` or `<title>` hole
 * passes its element, and the element's text is set.
 */
export function setText(start: Node, value: unknown): void {
  const text = formatText(value);
  if (start.nodeType === 1) {
    if (start.textContent !== text) {
      start.textContent = text;
    }
    return;
  }
  const first = start.nextSibling;
  if (first?.nodeType === 3) {
    if (first.nodeValue !== text) {
      first.nodeValue = text;
    }
  } else if (text !== '') {
    start.parentNode?.insertBefore(start.ownerDocument!.createTextNode(text), first);
  }
}

/**
 * Sets or removes an attribute, or sets the property for `value`, `checked` and `selected`.
 */
export function setAttr(el: Element, name: string, value: unknown): void {
  if (name === 'value' || name === 'checked' || name === 'selected') {
    Reflect.set(el, name, name === 'value' ? formatText(value) : Boolean(value));
    return;
  }
  if (value === false || value === null || value === undefined) {
    el.removeAttribute(name);
  } else if (typeof value === 'object') {
    // A class object with no enabled name leaves the attribute out.
    const names = joinClass(value);
    if (names === '') {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, names);
    }
  } else {
    el.setAttribute(name, value === true ? '' : formatText(value));
  }
}

/** Writes the `on:<event>` attribute. */
export function setOn(el: Element, event: string, message: DomMessage): void {
  el.setAttribute(`on:${event}`, JSON.stringify(message));
}

interface Policy {
  createHTML(html: string): string;
}

interface PolicyFactory {
  createPolicy(name: string, rules: Policy): Policy;
}

// A local view of `globalThis`, since the DOM lib has no Trusted Types.
function isPolicyFactory(value: unknown): value is PolicyFactory {
  return isRecord(value) && typeof value.createPolicy === 'function';
}

function getTrustedTypes(): PolicyFactory | undefined {
  const types: unknown = Reflect.get(globalThis, 'trustedTypes');
  return isPolicyFactory(types) ? types : undefined;
}

const rules: Policy = { createHTML: (html) => html };
let policy: Policy | undefined;

/**
 * Parses HTML into nodes through the Trusted Types policy `idlip`. `ns` parses the markup
 * inside an `<svg>` or `<math>` wrapper so it keeps its namespace.
 */
export function parseHtml(doc: Document, html: string, ns?: Namespace): Node[] {
  const template = doc.createElement('template');
  let wrapper = '';
  if (ns === 'svg') {
    wrapper = 'svg';
  } else if (ns === 'mathml') {
    wrapper = 'math';
  }
  const source = wrapper === '' ? html : `<${wrapper}>${html}</${wrapper}>`;
  policy ??= getTrustedTypes()?.createPolicy('idlip', rules) ?? rules;
  template.innerHTML = policy.createHTML(source);
  const parent = wrapper === '' ? template.content : template.content.firstChild;
  return [...(parent?.childNodes ?? [])];
}

/** Finds the comment that closes the condition block opened by `start`. */
function findEnd(start: Comment): Comment | null {
  let depth = 0;
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (!isComment(node)) {
      continue;
    }
    if (node.data === '/c') {
      if (depth === 0) {
        return node;
      }
      depth--;
    } else if (matchMarker(node.data)?.[0] === 'c') {
      depth++;
    }
  }
  return null;
}

/**
 * When `branch` differs from the marker's, replaces the block's content with
 * `render(branch)` and updates the marker. The hooks run children first: before the swap
 * for the blocks inside the old content and then the block, after it for the blocks inside
 * the new content and then the block.
 */
export function setBranch(
  start: Comment,
  branch: number,
  render: (branch: number) => string,
  ns?: Namespace,
): void {
  const colon = start.data.indexOf(':');
  const end = findEnd(start);
  const parent = start.parentNode;
  if (start.data.slice(colon + 1) === String(branch) || end === null || parent === null) {
    return;
  }
  for (const block of findInnerBlocks(start, end)) {
    removeBlock(block);
  }
  removeBlock(start);
  while (start.nextSibling !== end) {
    start.nextSibling?.remove();
  }
  const doc = start.ownerDocument;
  for (const node of parseHtml(doc, render(branch), ns)) {
    parent.insertBefore(node, end);
  }
  start.data = `${start.data.slice(0, colon + 1)}${branch}`;
  clearNodes();
  for (const block of findInnerBlocks(start, end)) {
    addBlock(block);
  }
  addBlock(start);
}
