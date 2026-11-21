import { isComment, isElement, matchMarker } from './guards.ts';

type Index = Map<string, Node>;

let cache: { root: ParentNode; index: Index } | undefined;

/** Forgets the nodes found so far. A branch swap calls it, since it moves markers. */
export function clearNodes(): void {
  cache = undefined;
}

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
export function findNode(root: ParentNode, name: string): Node | undefined {
  if (cache?.root !== root) {
    cache = { root, index: buildIndex(root) };
  }
  return cache.index.get(name);
}
