// oxlint-disable import/prefer-default-export
import type { ListBinding, ListChunk, NodeBinding, PropBinding, Scope } from '../../core/format.ts';
import { failRegion } from '../errors.ts';
import { HAS_CHILDREN, HAS_ERRORS, HAS_INNER_LISTS, HAS_KEY_FN } from '../features.ts';
import { isComment, isElement, matchMarker } from '../patch/guards.ts';
import { added, rowHooks } from '../patch/blocks.ts';
import type { RowContext } from '../patch/patch.ts';
import { addBlock, findInnerBlocks, readField, removeBlock } from '../patch/index.ts';

/**
 * The start marker of a row. It keeps the nodes of the row found so far, since a row stays in
 * the page between patches and is walked once.
 */
interface RowStart extends Comment {
  rowNodes?: Map<string, Node>;
}

interface Range {
  readonly start: RowStart;
  readonly end: Comment;
}

function getData(node: Node | null): string | undefined {
  return isComment(node) ? node.data : undefined;
}

// Maps the binding names in a node and its subtree to their nodes, and returns the last node of
// the walk at its level.
function indexNode(node: Node, nodes: Map<string, Node>): Node {
  if (isElement(node)) {
    for (const id of node.getAttribute('i-a')?.split(' ') ?? []) {
      nodes.set(`a${id}`, node);
    }
  }
  const name = isComment(node) ? matchMarker(node.data) : undefined;
  if (name !== undefined) {
    nodes.set(name, node);
  }
  if (HAS_CHILDREN && name === 'n:') {
    // A nested child has its own binding ids, so its markup is skipped whole.
    let level = 0;
    for (let next: Node | null = node; next !== null; next = next.nextSibling) {
      const data = getData(next) ?? '';
      level += data.startsWith('n:') ? 1 : 0;
      level -= data === '/n' ? 1 : 0;
      if (level === 0) {
        return next;
      }
    }
    return node;
  }
  for (let child: Node | null = node.firstChild; child !== null; child = child.nextSibling) {
    child = indexNode(child, nodes);
  }
  return node;
}

// Maps the binding names inside a row to their nodes, nested ones included.
function findNodes(range: Range): Map<string, Node> {
  const nodes = new Map<string, Node>();
  for (let node: Node | null = range.start; node !== null; node = node.nextSibling) {
    node = indexNode(node, nodes);
    if (node === range.end) {
      break;
    }
  }
  return nodes;
}

function getTopNodes(range: Range): ChildNode[] {
  const nodes: ChildNode[] = [];
  for (let node: ChildNode | null = range.start; node !== null; node = node.nextSibling) {
    nodes.push(node);
    if (node === range.end) {
      break;
    }
  }
  return nodes;
}

// The rows between a list's markers, and the end marker. A nested list's rows can be siblings
// of this row's markers, so rows and the end are found by counting depth.
function readRows(start: Comment): { rows: Range[]; end: Comment } {
  const rows: Range[] = [];
  let first = start;
  let depth = 0;
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (!isComment(node)) {
      continue;
    }
    const { data } = node;
    if (depth === 0 && data === '/l') {
      return { rows, end: node };
    }
    if (data === 'i' && depth++ === 0) {
      first = node;
    } else if (data === '/i' && --depth === 0) {
      rows.push({ start: first, end: node });
    }
  }
  throw new Error('A list has no end marker');
}

// The positions in `olds` of a longest increasing run, skipping -1.
function getStayers(olds: readonly number[]): Set<number> {
  const tails: number[] = [];
  const before: number[] = [];
  for (let j = 0; j < olds.length; j++) {
    const old = olds[j];
    if (old < 0) {
      continue;
    }
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (olds[tails[mid]] < old) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    before[j] = low > 0 ? tails[low - 1] : -1;
    tails[low] = j;
  }
  const stay = new Set<number>();
  for (let j = tails.at(-1) ?? -1; j >= 0; j = before[j]) {
    stay.add(j);
  }
  return stay;
}

function getRowScope(scope: Scope, item: unknown, index: number): Scope {
  return { ...scope, rows: [...scope.rows, { item, index }] };
}

// Returns the node of a binding in a row. A node that left the page, such as one in a branch an
// earlier binding swapped out, makes the row be walked again.
function findRowNode(range: Range, name: string): Node | undefined {
  const { start } = range;
  let node = start.rowNodes?.get(name);
  if (!node?.isConnected) {
    start.rowNodes = findNodes(range);
    node = start.rowNodes.get(name);
  }
  return node;
}

// Runs the chosen bindings of a kept row.
async function patchRow(
  range: Range,
  context: RowContext,
  prev: Scope,
  next: Scope,
): Promise<void> {
  for (const name of context.list.bindings) {
    const binding = context.bindings.get(name);
    if (binding === undefined) {
      continue;
    }
    if (HAS_CHILDREN && name[0] === 'p') {
      // A props binding has no node.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (binding as PropBinding)(next);
      continue;
    }
    const node = findRowNode(range, name);
    if (node === undefined) {
      continue;
    }
    if (name[0] !== 'l') {
      if (HAS_ERRORS) {
        try {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          (binding as NodeBinding)(node, next);
        } catch (error) {
          // The swap replaces nodes of the row, which the lookup then walks for again.
          if (!(await failRegion(context.page, node, error, next))) {
            throw error;
          }
        }
      } else {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        (binding as NodeBinding)(node, next);
      }
      continue;
    }
    // A nested list: patch its rows with the scopes of this row. All chosen bindings go through,
    // at any depth, and each list takes the ones it names.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const list = binding as ListBinding;
    await patchList(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      node as Comment,
      list(prev),
      list(next),
      { ...context, list: context.page.manifest.lists[name.slice(1)], prev, next },
    );
  }
}

export async function patchList(
  start: Comment,
  prev: readonly unknown[],
  next: readonly unknown[],
  context: RowContext,
): Promise<void> {
  const { list, page } = context;
  // A branch that swapped earlier in this patch rendered the list from the new model.
  if (HAS_INNER_LISTS && added.has(start)) {
    return;
  }

  // A computed key lives in the list chunk, so the chunk loads before the rows are paired.
  // Load the template before the DOM changes, so a failed load leaves the list as it was.
  let chunk: ListChunk | undefined;
  const { key } = list;
  if (HAS_KEY_FN && key === undefined) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    chunk = (await page.load(page.manifest.module, list.chunk)) as ListChunk;
  }
  function readKey(item: unknown): unknown {
    return HAS_KEY_FN && key === undefined ? chunk?.key?.(item) : readField(item, key ?? '');
  }

  // Pair the new items with the old rows by key. The DOM holds the old rows in order.
  // A key that is new or repeated counts as an insert.
  const oldIndexes = new Map<unknown, number>();
  for (let i = 0; i < prev.length; i++) {
    oldIndexes.set(readKey(prev[i]), i);
  }
  const olds: number[] = [];
  const used = new Set<number>();
  for (const item of next) {
    const old = oldIndexes.get(readKey(item));
    if (old === undefined || used.has(old)) {
      olds.push(-1);
    } else {
      used.add(old);
      olds.push(old);
    }
  }

  if (chunk === undefined && used.size < next.length) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    chunk = (await page.load(page.manifest.module, list.chunk)) as ListChunk;
  }

  const { rows, end } = readRows(start);
  for (let i = 0; i < rows.length; i++) {
    if (!used.has(i)) {
      const row = rows[i];
      // Children go before their parents. Only hooks that act inside rows need the walk.
      if (rowHooks > 0) {
        for (const block of findInnerBlocks(row.start, row.end)) {
          removeBlock(block);
        }
      }
      // Only the top-level nodes are removed, with their subtrees.
      for (const node of getTopNodes(row)) {
        node.remove();
      }
    }
  }

  // Render the new rows, then place all rows from the back. Kept rows in the longest stable
  // run stay where they are.
  const stay = getStayers(olds);
  const placed: Range[] = [];
  const inserts: (Node[] | undefined)[] = [];
  const blocks: Comment[][] = [];
  for (let j = 0; j < next.length; j++) {
    if (olds[j] >= 0) {
      placed.push(rows[olds[j]]);
      continue;
    }
    // A row is a cloned fragment that starts and ends with its row markers.
    const nodes = [
      ...chunk!.render(getRowScope(context.next, next[j], j), start.ownerDocument).childNodes,
    ];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const first = nodes[0] as Comment;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const last = nodes.at(-1) as Comment;
    placed.push({ start: first, end: last });
    inserts[j] = nodes;
    // The blocks of a row, found before it moves into the page. The chunk says whether its rows
    // hold any.
    blocks[j] = chunk!.blocks ? findInnerBlocks(first, last) : [];
  }
  let before: ChildNode = end;
  for (let j = next.length - 1; j >= 0; j--) {
    const row = placed[j];
    const nodes = inserts[j];
    if (nodes !== undefined) {
      before.before(...nodes);
      for (const block of blocks[j]) {
        addBlock(block);
      }
    } else if (!stay.has(j)) {
      before.before(...getTopNodes(row));
    }
    before = row.start;
  }

  // A kept row whose item is the same reference is left as it is when the bindings read nothing
  // else that changed.
  for (let j = 0; j < next.length; j++) {
    const old = olds[j];
    if (old >= 0 && !(context.items && prev[old] === next[j])) {
      const prevScope = getRowScope(context.prev, prev[old], old);
      const nextScope = getRowScope(context.next, next[j], j);
      await patchRow(placed[j], context, prevScope, nextScope);
    }
  }
}
