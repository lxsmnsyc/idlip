import { HAS_INNER_LISTS } from '../features.ts';
import { isComment, matchMarker } from './guards.ts';

type BlockHook = (start: Comment) => void;

const addHooks: BlockHook[] = [];
const removeHooks: BlockHook[] = [];

/** The number of hooks that may act on blocks inside list rows. */
// oxlint-disable-next-line import/no-mutable-exports
export let rowHooks = 0;

/**
 * The number of blocks added so far. A row's cached nodes are good while it stays the same,
 * since every branch swap and region swap adds its block.
 */
// oxlint-disable-next-line import/no-mutable-exports
export let addCount = 0;

/**
 * Registers a hook that does nothing for blocks inside list rows, so removed rows need no walk
 * for it. Internal: `onBlock` is the public form.
 */
export function onPageBlock(add: BlockHook, remove: BlockHook): void {
  addHooks.push(add);
  removeHooks.push(remove);
}

/**
 * Registers code that runs when a condition or list block is added or removed.
 * Hooks are synchronous, and nothing awaits what they start.
 */
export function onBlock(add: BlockHook, remove: BlockHook): void {
  onPageBlock(add, remove);
  rowHooks++;
}

/**
 * The blocks added since the running patch started. A list among them was rendered from the
 * new model, so the patch leaves it as it is.
 */
export const added: Set<Comment> = new Set();

/** Calls the add hooks for a block whose markup is in the page. */
export function addBlock(start: Comment): void {
  addCount++;
  if (HAS_INNER_LISTS) {
    added.add(start);
  }
  for (const hook of addHooks) {
    hook(start);
  }
}

/** Calls the remove hooks for a block whose markup is still in the page. */
export function removeBlock(start: Comment): void {
  for (const hook of removeHooks) {
    hook(start);
  }
}

function collectBlocks(node: Node, blocks: Comment[]): void {
  if (isComment(node)) {
    const marker = matchMarker(node.data);
    if (marker !== undefined && marker[0] !== 't') {
      blocks.push(node);
    }
    return;
  }
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    collectBlocks(child, blocks);
  }
}

/**
 * Returns the blocks between `start` and `end`, children before parents.
 */
export function findInnerBlocks(start: Node, end: Node | null): Comment[] {
  const blocks: Comment[] = [];
  for (let node = start.nextSibling; node !== null && node !== end; node = node.nextSibling) {
    collectBlocks(node, blocks);
  }
  // Document order puts a parent before its children, so the reverse puts children first.
  return blocks.reverse();
}
