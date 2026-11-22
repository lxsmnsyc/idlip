// The render helpers of the server module (`text`, `attr`, `on`) and the DOM helpers of client
// chunks (`setText`, `setAttr`, `setOn`, `setBranch`, `clone` and the rest). Each has one
// source, here. The server imports the render helpers. A client chunk imports the ones it uses
// from `idlip/helpers`, one shared module that `printHelpersModule` writes from the text of
// these functions. The Vite plugin serves it, the bundler keeps the helpers the chunks use, and
// the loader starts loading it with the first chunk. The loader stays small, and a build ships
// each helper once. Rules for the sources:
// - Every function is named with a `$` suffix, so a copy cannot clash with a name in the module.
// - No comment inside a body, since the copy is the text of the function.
// - A function calls only the functions of `HELPERS` and the forwarders, by their names.
// - A loader export is called as `name$`, through the forwarding function below. In a chunk the
//   name is the import alias, `parseHtml as parseHtml$`. A bundler or a test runner renames
//   imported bindings in the text of a function, but not a function declared in the module.
// oxlint-disable typescript/no-base-to-string, no-control-regex, no-console
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

export function getText$(value: unknown): string {
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
 * `render(branch, doc)`, a cloned fragment, and updates the marker. The hooks run children
 * first: before the swap for the blocks inside the old content and then the block, after it for
 * the blocks inside the new content and then the block. The loader forgets the nodes it found as
 * the hooks run.
 */
export function setBranch$(
  start: Comment,
  branch: number,
  render: (branch: number, doc: Document) => Node,
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
  parent.insertBefore(render(branch, start.ownerDocument), end);
  start.data = `${start.data.slice(0, colon + 1)}${branch}`;
  for (const block of findInnerBlocks$(start, end)) {
    addBlock$(block);
  }
  addBlock$(start);
}

/** A cloned template of a chunk: its HTML, and once parsed, its content and the paths to its marks. */
function isElement$(node: Node): node is Element {
  return node.nodeType === 1;
}

export interface Template {
  /** The HTML. */
  readonly h: string;
  /** The number of marks. */
  readonly n: number;
  /** The namespace the HTML is parsed in, for a body inside `<svg>` or `<math>`. */
  readonly s?: Namespace;
  /** The parse for the first document that cloned it, the page's. */
  k?: { d: Document; c: ParentNode; p: number[][] };
  /** The parse for any other document, such as an iframe's. */
  m?: WeakMap<Document, { d: Document; c: ParentNode; p: number[][] }>;
}

/**
 * Clones a template of static markup in `doc`. Returns the fragment, then the node of each
 * mark: an element with `i-x="<n>"`, a text node in place of `<!--x<n>-->`, or a comment
 * `<!--<data>x<n>-->` that keeps `<data>`, the start or end of a block. The first call in a
 * document parses the template and finds the marks where the parser put them.
 */
export function clone$(template: Template, doc: Document): Node[] {
  let parsed = template.k;
  if (parsed?.d !== doc) {
    parsed = template.m?.get(doc);
  }
  if (parsed === undefined) {
    const root = doc.createDocumentFragment();
    root.append(...parseHtml$(doc, template.h, template.s));
    const paths: number[][] = [];
    let found = 0;
    const walker = doc.createTreeWalker(root, 129);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const match = isElement$(node) ? null : /^(.*?)x(\d+)$/.exec(node.nodeValue!);
      const mark = isElement$(node) ? node.getAttribute('i-x') : match?.[2];
      if (mark === null || mark === undefined) {
        continue;
      }
      if (isElement$(node)) {
        node.removeAttribute('i-x');
      } else if (match![1] === '') {
        const text = doc.createTextNode(' ');
        node.parentNode!.replaceChild(text, node);
        walker.currentNode = text;
        node = text;
      } else {
        node.nodeValue = match![1];
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
      found++;
    }
    if (found !== template.n) {
      throw new Error(`idlip: a template has ${template.n} marks and the parse found ${found}`);
    }
    parsed = { d: doc, c: root, p: paths };
    if (template.k === undefined) {
      template.k = parsed;
    } else {
      (template.m ??= new WeakMap()).set(doc, parsed);
    }
  }
  const fragment = doc.importNode(parsed.c, true);
  const nodes: Node[] = [fragment];
  for (const path of parsed.p) {
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
export function getRows$(
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

/**
 * Every function the module holds, by name. A copy calls only functions of this table and the
 * forwarders, by these names. The order does not matter, since function declarations hoist.
 */
const HELPERS: Record<string, Source | undefined> = {
  getText$,
  escapeText$,
  escapeAttr$,
  joinClass$,
  encode$,
  findEnd$,
  getRows$,
  text$,
  safeUrl$,
  attr$,
  on$,
  slot$,
  setText$,
  setAttr$,
  setOn$,
  track$,
  isElement$,
  clone$,
  putAttr$,
  putText$,
  setBranch$,
};

/** The forwarding functions. The module replaces each by an import of the loader's export. */
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

/** The specifier chunks import the helpers from. */
export const HELPERS_MODULE = 'idlip/helpers';

/**
 * Returns the source of the `idlip/helpers` module: a copy of every helper, the loader exports
 * they call as imports from `idlip/client`, and an export of each helper. It throws when a
 * bundler renamed a function, since the copies call each other by name.
 */
export function printHelpersModule(): string {
  const code: string[] = [];
  for (const [name, source] of Object.entries(HELPERS)) {
    if (source?.name !== name) {
      throw new Error(`The helper ${name} was renamed to ${source?.name}`);
    }
    code.push(source.toString());
  }
  const specifiers: string[] = [];
  for (const [name, forwarder] of Object.entries(FORWARDERS)) {
    if (forwarder?.name !== name) {
      throw new Error(`The forwarder ${name} was renamed to ${forwarder?.name}`);
    }
    specifiers.push(`${name.slice(0, -1)} as ${name}`);
  }
  return `import { ${specifiers.join(', ')} } from 'idlip/client';\n\n${code.join('\n\n')}\n\nexport { ${Object.keys(HELPERS).join(', ')} };\n`;
}
