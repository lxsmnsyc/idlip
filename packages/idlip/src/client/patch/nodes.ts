import { HAS_CHILDREN, HAS_DOCUMENT } from '../features.ts';
import { onPageBlock } from './blocks.ts';
import { isComment, isElement, matchMarker } from './guards.ts';

type Index = Map<string, Node>;

let cache: { root: ParentNode; from: Comment | undefined; index: Index } | undefined;

/** Tells whether a node is inside a list row, whose nodes the index does not hold. */
function isInRow(start: Node): boolean {
  for (let node: Node | null = start; node !== null; node = node.parentNode) {
    let depth = 0;
    for (let item = node.previousSibling; item !== null; item = item.previousSibling) {
      if (!isComment(item)) {
        continue;
      }
      if (item.data === '/i') {
        depth++;
      } else if (item.data === 'i') {
        if (depth === 0) {
          return true;
        }
        depth--;
      }
    }
  }
  return false;
}

/**
 * A branch swap moves markers, so the nodes found so far are forgotten. A copied `setBranch`
 * calls the block hooks as it swaps. A block inside a row is not in the index.
 */
function forgetNodes(start: Comment): void {
  if (!isInRow(start)) {
    cache = undefined;
  }
}

onPageBlock(forgetNodes, forgetNodes);

/** Moves the walker from a start boundary comment to its end comment. */
function skipChild(walker: TreeWalker): void {
  let level = 1;
  for (let next = walker.nextSibling(); next !== null; next = walker.nextSibling()) {
    const data = isComment(next) ? next.data : '';
    level += data.startsWith('n:') ? 1 : 0;
    level -= data === '/n' ? 1 : 0;
    if (level === 0) {
      break;
    }
  }
}

/**
 * Walks the page once and maps binding export names to nodes: `a<id>` to an element,
 * `t<id>`, `c<id>` and `l<id>` to a start comment. Rows are skipped.
 */
function buildIndex(root: ParentNode, from?: Comment): Index {
  const index: Index = new Map();
  const walker = root.ownerDocument!.createTreeWalker(root, 1 | 128);
  let depth = 0;
  if (HAS_CHILDREN && from !== undefined) {
    // A child's bindings are between its boundary comments.
    walker.currentNode = from;
  }
  // A page rooted at `<html>` has bindings on the root itself, which the walk would skip.
  for (
    let node = HAS_DOCUMENT && from === undefined ? root : walker.nextNode();
    node !== null;
    node = walker.nextNode()
  ) {
    if (isElement(node)) {
      const ids = depth === 0 ? node.getAttribute('i-a') : null;
      for (const id of ids?.split(' ') ?? []) {
        index.set(`a${id}`, node);
      }
    } else if (isComment(node)) {
      const marker = matchMarker(node.data);
      if (HAS_CHILDREN && marker === 'n:') {
        // A nested child has its own binding ids, so its markup is skipped whole.
        skipChild(walker);
      } else if (HAS_CHILDREN && node.data === '/n') {
        // The end of the child that the walk started in.
        break;
      } else if (node.data === 'i') {
        depth++;
      } else if (node.data === '/i') {
        depth--;
      } else if (depth === 0 && marker !== undefined) {
        index.set(marker, node);
      }
    }
  }
  return index;
}

/** Returns the node of a binding outside rows. The first call walks the page. */
// oxlint-disable-next-line import/prefer-default-export
export function findNode(root: ParentNode, name: string, from?: Comment): Node | undefined {
  if (cache?.root !== root || (HAS_CHILDREN && cache.from !== from)) {
    cache = { root, from, index: buildIndex(root, from) };
  }
  return cache.index.get(name);
}
