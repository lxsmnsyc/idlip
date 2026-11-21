// The render helpers (`text`, `attr`, `on`) and the DOM helpers (`setText`, `setAttr`, `setOn`,
// `setBranch`) of compiled modules. Each has one source, here. The server imports the render
// helpers. A client chunk does not import any of them: the compiler copies the ones it uses
// into the chunk with `printHelpers`, from the text of these functions, so the loader stays
// small. Rules for the sources:
// - Every function is named with a `$` suffix, so a copy cannot clash with a name in the module.
// - No comment inside a body, since the copy is the text of the function.
// - A function mentions only what `HELPERS` lists for it.
// - A loader export is called as `name$`, through the forwarding function below. In a chunk the
//   name is the import alias, `parseHtml as parseHtml$`. A bundler or a test runner renames
//   imported bindings in the text of a function, but not a function declared in the module.
// oxlint-disable typescript/no-base-to-string
import { addBlock, findInnerBlocks, removeBlock } from '../client/patch/blocks.ts';
import { parseHtml } from '../client/patch/dom.ts';
import type { Namespace } from '../client/patch/dom.ts';
import type { DomMessage } from './format.ts';

function addBlock$(start: Comment): void {
  addBlock(start);
}

function findInnerBlocks$(start: Node, end: Node | null): Comment[] {
  return findInnerBlocks(start, end);
}

function parseHtml$(doc: Document, html: string, ns?: Namespace): Node[] {
  return parseHtml(doc, html, ns);
}

function removeBlock$(start: Comment): void {
  removeBlock(start);
}

function getText$(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  return String(value);
}

function escapeText$(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr$(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function joinClass$(value: object): string {
  const names: string[] = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

function encode$(part: string): string {
  return encodeURIComponent(part).replaceAll('-', '%2D');
}

function findEnd$(start: Comment): Node | null {
  let depth = 0;
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (node.nodeType !== 8) {
      continue;
    }
    if (node.nodeValue === '/c') {
      if (depth === 0) {
        return node;
      }
      depth--;
    } else if (/^c\d/.test(node.nodeValue ?? '')) {
      depth++;
    }
  }
  return null;
}

/**
 * Returns the model path of a child: the parent's path, then the site of the child and one
 * escaped key for each enclosing loop and an explicit `key`. A key part never holds `/`, `:`,
 * `-` or `>`, so a path splits cleanly and cannot end a comment.
 */
export function slot$(path: string, site: number, ...keys: unknown[]): string {
  let id = String(site);
  for (const key of keys) {
    id += `:${encode$(String(key))}`;
  }
  return path === '' ? id : `${path}/${id}`;
}

/**
 * Returns a hole's value as escaped text.
 */
export function text$(value: unknown): string {
  return escapeText$(getText$(value));
}

/**
 * Returns an attribute with a leading space, or an empty string when it is absent.
 */
export function attr$(name: string, value: unknown): string {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (value === true) {
    return ` ${name}`;
  }
  if (name === 'class' && typeof value === 'object') {
    const names = joinClass$(value);
    return names === '' ? '' : ` ${name}="${escapeAttr$(names)}"`;
  }
  return ` ${name}="${escapeAttr$(getText$(value))}"`;
}

/**
 * Returns an `on:<event>` attribute with a leading space.
 */
export function on$(event: string, message: DomMessage): string {
  const json = JSON.stringify(message).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
  return ` on:${event}='${json}'`;
}

/**
 * Sets the text between `start` and its end comment. A `<textarea>` or `<title>` hole
 * passes its element, and the element's text is set.
 */
export function setText$(start: Node, value: unknown): void {
  const text = getText$(value);
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
export function setAttr$(el: Element, name: string, value: unknown): void {
  if (name === 'value' || name === 'checked' || name === 'selected') {
    Reflect.set(el, name, name === 'value' ? getText$(value) : Boolean(value));
    return;
  }
  if (value === false || value === null || value === undefined) {
    el.removeAttribute(name);
  } else if (typeof value === 'object') {
    const names = joinClass$(value);
    if (names === '') {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, names);
    }
  } else {
    el.setAttribute(name, value === true ? '' : getText$(value));
  }
}

/**
 * Writes the `on:<event>` attribute.
 */
export function setOn$(el: Element, event: string, message: DomMessage): void {
  el.setAttribute(`on:${event}`, JSON.stringify(message));
}

/**
 * When `branch` differs from the marker's, replaces the block's content with
 * `render(branch)` and updates the marker. The hooks run children first: before the swap
 * for the blocks inside the old content and then the block, after it for the blocks inside
 * the new content and then the block. The loader forgets the nodes it found as the hooks run.
 */
export function setBranch$(
  start: Comment,
  branch: number,
  render: (branch: number) => string,
  ns?: Namespace,
): void {
  const colon = start.data.indexOf(':');
  const end = findEnd$(start);
  const parent = start.parentNode;
  if (start.data.slice(colon + 1) === String(branch) || end === null || parent === null) {
    return;
  }
  for (const block of findInnerBlocks$(start, end)) {
    removeBlock$(block);
  }
  removeBlock$(start);
  while (start.nextSibling !== end) {
    start.nextSibling?.remove();
  }
  for (const node of parseHtml$(start.ownerDocument, render(branch), ns)) {
    parent.insertBefore(node, end);
  }
  start.data = `${start.data.slice(0, colon + 1)}${branch}`;
  for (const block of findInnerBlocks$(start, end)) {
    addBlock$(block);
  }
  addBlock$(start);
}

type Source = (...args: never[]) => unknown;

interface Helper {
  source: Source;
  /** The helpers whose copy this one needs, by function name. */
  uses: string[];
  /** The names of the loader's exports this one calls, such as `parseHtml`. */
  client: string[];
}

/** Every function that can be copied, in the order the copies print. */
const HELPERS: Record<string, Helper | undefined> = {
  getText$: { source: getText$, uses: [], client: [] },
  escapeText$: { source: escapeText$, uses: [], client: [] },
  escapeAttr$: { source: escapeAttr$, uses: [], client: [] },
  joinClass$: { source: joinClass$, uses: [], client: [] },
  encode$: { source: encode$, uses: [], client: [] },
  findEnd$: { source: findEnd$, uses: [], client: [] },
  text$: { source: text$, uses: ['getText$', 'escapeText$'], client: [] },
  attr$: { source: attr$, uses: ['getText$', 'escapeAttr$', 'joinClass$'], client: [] },
  on$: { source: on$, uses: [], client: [] },
  slot$: { source: slot$, uses: ['encode$'], client: [] },
  setText$: { source: setText$, uses: ['getText$'], client: [] },
  setAttr$: { source: setAttr$, uses: ['getText$', 'joinClass$'], client: [] },
  setOn$: { source: setOn$, uses: [], client: [] },
  setBranch$: {
    source: setBranch$,
    uses: ['findEnd$'],
    client: ['addBlock', 'findInnerBlocks', 'parseHtml', 'removeBlock'],
  },
};

/** The forwarding functions. A chunk replaces each by an import of the loader's export. */
const FORWARDERS: Record<string, Source | undefined> = {
  addBlock$,
  findInnerBlocks$,
  parseHtml$,
  removeBlock$,
};

/** The names a chunk defines or imports for the copies. */
export const HELPER_NAMES: readonly string[] = [
  ...Object.keys(HELPERS),
  ...Object.keys(FORWARDERS),
];

export interface PrintedHelpers {
  /** The source of each function the chunk needs, dependencies first. */
  code: string[];
  /** The names to import from `idlip/client`, which the loader holds. */
  client: Set<string>;
}

/**
 * Returns the code to copy into a chunk that uses the given helpers (`text`, `setAttr` and
 * so on), and the loader exports that code needs.
 */
export function printHelpers(names: Iterable<string>): PrintedHelpers {
  const wanted = new Set<string>();
  const client = new Set<string>();
  const queue: string[] = [];
  for (const name of names) {
    queue.push(`${name}$`);
  }
  while (queue.length > 0) {
    const name = queue.pop()!;
    const helper = HELPERS[name];
    if (helper === undefined) {
      throw new Error(`Unknown helper ${name}`);
    }
    if (wanted.has(name)) {
      continue;
    }
    wanted.add(name);
    queue.push(...helper.uses);
    for (const imported of helper.client) {
      client.add(imported);
    }
  }
  const code: string[] = [];
  for (const [name, helper] of Object.entries(HELPERS)) {
    if (helper === undefined || !wanted.has(name)) {
      continue;
    }
    // A bundler may rename a function, which would break the names the copies call.
    if (helper.source.name !== name) {
      throw new Error(`The helper ${name} was renamed to ${helper.source.name}`);
    }
    code.push(helper.source.toString());
  }
  for (const imported of client) {
    const forwarder = FORWARDERS[`${imported}$`];
    if (forwarder?.name !== `${imported}$`) {
      throw new Error(`The forwarder ${imported}$ was renamed to ${forwarder?.name}`);
    }
  }
  return { code, client };
}
