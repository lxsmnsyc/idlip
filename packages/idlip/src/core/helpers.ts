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
// oxlint-disable typescript/no-base-to-string, no-control-regex
import { addBlock, findInnerBlocks, removeBlock } from '../client/patch/blocks.ts';
import { parseHtml } from '../client/patch/dom.ts';
import { track$ } from './dynamic.ts';
import type { Namespace } from '../client/patch/dom.ts';
import type { DomMessage } from './format.ts';

export { track$ };

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
 * Returns a URL attribute's value, or `undefined` for a `javascript:` or `vbscript:` URL, so the
 * attribute is left out. An object or function is dropped too, since `attr$` would join its keys.
 * A browser ignores control characters and spaces in a scheme, so they are removed before the
 * test. With `embed`, a `data:` URL is dropped too, unless it is a raster image. The `values` of
 * an animation is a `;` list, so each part is tested. Wraps every bound value of a URL attribute,
 * on the server and in a chunk.
 */
export function safeUrl$(value: unknown, name: string, embed?: boolean): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return value;
  }
  let unsafe = typeof value === 'object' || typeof value === 'function';
  if (!unsafe) {
    for (const part of name === 'values' ? String(value).split(';') : [String(value)]) {
      const url = part.replace(/[\u0000- ]/g, '');
      if (
        /^(?:javascript|vbscript):/i.test(url) ||
        (embed === true &&
          /^data:/i.test(url) &&
          !/^data:image\/(?:png|gif|jpe?g|webp|avif|bmp)[;,]/i.test(url))
      ) {
        unsafe = true;
      }
    }
  }
  if (unsafe) {
    if (process.env.NODE_ENV !== 'production') {
      // oxlint-disable-next-line no-console
      console.warn(`idlip: dropped an unsafe URL from ${name}.`);
    }
    return undefined;
  }
  return value;
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
 * `render(branch)`, HTML or a cloned fragment, and updates the marker. The hooks run children first: before the swap
 * for the blocks inside the old content and then the block, after it for the blocks inside
 * the new content and then the block. The loader forgets the nodes it found as the hooks run.
 */
export function setBranch$(
  start: Comment,
  branch: number,
  render: (branch: number) => string | Node,
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
  const html = render(branch);
  for (const node of typeof html === 'string'
    ? parseHtml$(start.ownerDocument, html, ns)
    : [html]) {
    parent.insertBefore(node, end);
  }
  start.data = `${start.data.slice(0, colon + 1)}${branch}`;
  for (const block of findInnerBlocks$(start, end)) {
    addBlock$(block);
  }
  addBlock$(start);
}

/** A cloned template of a chunk: its HTML, and once parsed, its content and the paths to its marks. */
export interface Template {
  readonly h: string;
  d?: Document;
  c?: ParentNode;
  p?: number[][];
}

/**
 * Clones a template of static markup. Returns the fragment, then the node of each mark: an
 * element with `i-x="<n>"`, or a text node in place of `<!--x<n>-->`. The first call parses the
 * template and finds the marks where the parser put them.
 */
export function clone$(template: Template): Node[] {
  if (template.d !== document) {
    const root = parseHtml$(document, template.h)[0].parentNode!;
    const paths: number[][] = [];
    const walker = document.createTreeWalker(root, 129);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const mark =
        node instanceof Element ? node.getAttribute('i-x') : /^x(\d+)$/.exec(node.nodeValue!)?.[1];
      if (mark === null || mark === undefined) {
        continue;
      }
      if (node instanceof Element) {
        node.removeAttribute('i-x');
      } else {
        const text = document.createTextNode(' ');
        node.parentNode!.replaceChild(text, node);
        walker.currentNode = text;
        node = text;
      }
      const path: number[] = [];
      for (let at = node; at !== root; at = at.parentNode!) {
        let index = 0;
        for (let before = at.previousSibling; before !== null; before = before.previousSibling) {
          index++;
        }
        path.unshift(index);
      }
      paths[Number(mark) - 1] = path;
    }
    template.c = root;
    template.p = paths;
    template.d = document;
  }
  const fragment = document.importNode(template.c!, true);
  const nodes: Node[] = [fragment];
  for (const path of template.p!) {
    let node: Node = fragment;
    for (const index of path) {
      node = node.firstChild!;
      for (let step = 0; step < index; step++) {
        node = node.nextSibling!;
      }
    }
    nodes.push(node);
  }
  return nodes;
}

/** Writes an attribute on a cloned element, as `attr$` would have written it in the HTML. */
export function putAttr$(el: Element, name: string, value: unknown): void {
  if (value === false || value === null || value === undefined) {
    return;
  }
  if (value === true) {
    el.setAttribute(name, '');
  } else if (name === 'class' && typeof value === 'object') {
    const names = joinClass$(value);
    if (names !== '') {
      el.setAttribute(name, names);
    }
  } else {
    el.setAttribute(name, getText$(value));
  }
}

/** Writes the text of a cloned text node, or removes the node for an empty text, as the HTML has none. */
export function putText$(node: Node, value: unknown): void {
  const text = getText$(value);
  if (text === '') {
    node.parentNode!.removeChild(node);
  } else {
    node.nodeValue = text;
  }
}

/** Reads the rows around a region from the DOM: `reset` has no binding scope. `paths` maps a list id to its `each` path. */
function getRows$(
  start: Node,
  model: unknown,
  paths: Record<string, string>,
): { item: unknown; index: number }[] {
  const levels: { id: string; index: number }[] = [];
  let node: Node | null = start;
  while (node !== null) {
    let depth = 0;
    let row = false;
    let index = 0;
    let list: Node | undefined;
    for (
      let item = node.previousSibling;
      item !== null && list === undefined;
      item = item.previousSibling
    ) {
      const data = item.nodeType === 8 ? (item.nodeValue ?? '') : '';
      if (data === '/i') {
        index += row && depth === 0 ? 1 : 0;
        depth++;
      } else if (data === 'i') {
        row ||= depth === 0;
        depth -= depth === 0 ? 0 : 1;
      } else if (row && depth === 0 && /^l\d/.test(data)) {
        levels.push({ id: data.slice(1), index });
        list = item;
      }
    }
    node = list ?? node.parentNode;
  }
  const rows: { item: unknown; index: number }[] = [];
  for (const { id, index } of levels.toReversed()) {
    let value: unknown = model;
    let star = 0;
    for (const key of paths[id].split('.')) {
      value = Reflect.get(Object(value), key === '*' ? rows[star++].index : key);
    }
    rows.push({ item: Reflect.get(Object(value), index), index });
  }
  return rows;
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
  getRows$: { source: getRows$, uses: [], client: [] },
  text$: { source: text$, uses: ['getText$', 'escapeText$'], client: [] },
  safeUrl$: { source: safeUrl$, uses: [], client: [] },
  attr$: { source: attr$, uses: ['getText$', 'escapeAttr$', 'joinClass$'], client: [] },
  on$: { source: on$, uses: [], client: [] },
  slot$: { source: slot$, uses: ['encode$'], client: [] },
  setText$: { source: setText$, uses: ['getText$'], client: [] },
  setAttr$: { source: setAttr$, uses: ['getText$', 'joinClass$'], client: [] },
  setOn$: { source: setOn$, uses: [], client: [] },
  track$: { source: track$, uses: [], client: [] },
  clone$: { source: clone$, uses: [], client: ['parseHtml'] },
  putAttr$: { source: putAttr$, uses: ['getText$', 'joinClass$'], client: [] },
  putText$: { source: putText$, uses: ['getText$'], client: [] },
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
