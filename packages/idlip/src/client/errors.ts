// The client half of `<Try>`. A region is `<!--e<id>:<state>-->…<!--/e-->`: state `0` shows the
// body and state `1` the catch view. A binding that throws swaps its region to the catch view,
// and `$reset` renders the body again. `contracts/compiled-format-errors.change-request.md` and
// `contracts/compiled-format-errors-client.change-request.md` describe the markers and events.
// Everything here runs only behind `HAS_ERRORS`.
import type { Model, Page, Scope } from '../core/format.ts';
import { HAS_CHILDREN } from './features.ts';
import { addBlock, findInnerBlocks, removeBlock } from './patch/blocks.ts';
import { parseHtml } from './patch/dom.ts';
import type { Namespace } from './patch/dom.ts';
import { isComment } from './patch/guards.ts';

/** The state of a region, read from its start marker. */
interface Region {
  readonly id: string;
  readonly start: Comment;
  readonly state: 'body' | 'catch';
}

/** The exports of a `try=<id>` chunk. */
interface TryChunk {
  readonly render: (error: string, scope: Scope) => string;
  /** Only a catch view with `reset` has it. A region in a row also takes its start marker. */
  readonly region: (scope: Scope, start: Comment) => string;
  /** Set when the region is inside `<svg>` or `<math>`. */
  readonly namespace?: Namespace;
}

/** The tag of the message that `reset` renders. It has no handler chunk. */
export const RESET = '$reset';

/** Stands in for the update of a reset message: the model stays. */
export function keepModel(model: Model): Model {
  return model;
}

function readRegion(node: Node | null): Region | undefined {
  const match = isComment(node) ? /^e(\d+):([01])$/.exec(node.data) : null;
  return isComment(node) && match !== null
    ? { id: match[1], start: node, state: match[2] === '1' ? 'catch' : 'body' }
    : undefined;
}

/** Returns the nearest region around a node, or `undefined` outside any `<Try>`. */
function findRegion(from: Node): Region | undefined {
  for (let node: Node | null = from; node !== null; node = node.parentNode) {
    let depth = 0;
    let bounds = 0;
    for (let item = node.previousSibling; item !== null; item = item.previousSibling) {
      if (!isComment(item)) {
        continue;
      }
      if (item.data === '/e') {
        depth++;
      } else if (item.data[0] === 'e') {
        if (depth === 0) {
          return readRegion(item);
        }
        depth--;
      } else if (HAS_CHILDREN) {
        // A child has its own regions: the search stops at its boundary.
        if (item.data === '/n') {
          bounds++;
        } else if (item.data.startsWith('n:')) {
          if (bounds === 0) {
            return undefined;
          }
          bounds--;
        }
      }
    }
  }
  return undefined;
}

function findEnd(start: Comment): Comment | undefined {
  let depth = 0;
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (isComment(node)) {
      if (node.data === '/e') {
        if (depth === 0) {
          return node;
        }
        depth--;
      } else if (node.data[0] === 'e') {
        depth++;
      }
    }
  }
  return undefined;
}

/** Replaces a region, markers included, with markup that holds its new markers. */
function swapRegion(start: Comment, html: string, ns?: Namespace): void {
  const end = findEnd(start);
  const parent = start.parentNode;
  if (end === undefined || parent === null) {
    throw new Error('idlip: <Try> has no end');
  }
  // The region leaves like a removed block, so sources inside it stop.
  for (const block of findInnerBlocks(start, end)) {
    removeBlock(block);
  }
  removeBlock(start);
  const next = end.nextSibling;
  for (let node: Node = start; node !== next;) {
    const after: Node | null = node.nextSibling;
    parent.removeChild(node);
    node = after!;
  }
  const nodes = parseHtml(start.ownerDocument, html, ns);
  for (const node of nodes) {
    parent.insertBefore(node, next);
  }
  const [first] = nodes;
  if (isComment(first)) {
    for (const block of findInnerBlocks(first, next)) {
      addBlock(block);
    }
    addBlock(first);
  }
}

async function loadTry(page: Page, id: string): Promise<TryChunk> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await page.load(page.manifest.module, page.manifest.fallback![id])) as TryChunk;
}

/** Tells the page that something failed. Anything can listen, such as `deploy-skew`. */
export function fireError(error: unknown, path: string | undefined): void {
  document.dispatchEvent(new CustomEvent('idlip:error', { detail: { error, path: path ?? '' } }));
}

/**
 * Called when a binding of `node` throws. Swaps the region around it to the catch view and
 * returns `true`. Returns `false` when no region with a catch view is around the node, and the
 * caller rethrows.
 */
export async function failRegion(
  page: Page,
  node: Node,
  error: unknown,
  scope: Scope,
): Promise<boolean> {
  const region = findRegion(node);
  if (region?.state !== 'body' || page.manifest.fallback === undefined) {
    return false;
  }
  const { render, namespace } = await loadTry(page, region.id);
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  swapRegion(region.start, `<!--e${region.id}:1-->${render(text, scope)}<!--/e-->`, namespace);
  fireError(error, page.path);
  return true;
}

/**
 * Handles the message `["$reset", [id]]` from a button in a catch view: renders the region
 * again from the model. If the body still throws, the region shows the new error.
 */
export async function resetRegion(
  page: Page,
  model: Model,
  target: Element,
  id: unknown,
): Promise<void> {
  const region = findRegion(target);
  if (region?.state !== 'catch' || region.id !== String(id)) {
    throw new Error('idlip: no failed region');
  }
  const { region: render, namespace } = await loadTry(page, region.id);
  const scope = { model, props: page.props, rows: [], path: page.path };
  swapRegion(region.start, render(scope, region.start), namespace);
}
