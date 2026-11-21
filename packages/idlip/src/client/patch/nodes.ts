import { onBlock } from './blocks.ts';
import { isComment, isElement, matchMarker } from './guards.ts';

type Index = Map<string, Node>;

let cache: { root: ParentNode; index: Index } | undefined;

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

onBlock(forgetNodes, forgetNodes);

/**
 * Walks the page once and maps binding export names to nodes: `a<id>` to an element,
 * `t<id>`, `c<id>` and `l<id>` to a start comment. Rows are skipped.
 */
function buildIndex(root: ParentNode): Index {
  const index: Index = new Map();
  const walker = root.ownerDocument!.createTreeWalker(root, 1 | 128);
  let depth = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (isElement(node)) {
      const ids = depth === 0 ? node.getAttribute('i-a') : null;
      for (const id of ids?.split(' ') ?? []) {
        index.set(`a${id}`, node);
      }
    } else if (isComment(node)) {
      const marker = matchMarker(node.data);
      if (node.data === 'i') {
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
export function findNode(root: ParentNode, name: string): Node | undefined {
  if (cache?.root !== root) {
    cache = { root, index: buildIndex(root) };
  }
  return cache.index.get(name);
}
