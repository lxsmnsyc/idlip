// oxlint-disable import/prefer-default-export
import type {
  ListBinding,
  ListChunk,
  ListContext,
  NodeBinding,
  PatchList,
  PropBinding,
  Scope,
} from '../../core/format.ts';
import { failRegion } from '../errors.ts';
import { HAS_CHILDREN, HAS_ERRORS } from '../features.ts';
import { isComment, isElement } from '../patch/guards.ts';
import { addBlock, findInnerBlocks, parseHtml, readField, removeBlock } from '../patch/index.ts';

interface Range {
  readonly start: Comment;
  readonly end: Comment;
}

function getData(node: Node | null): string | undefined {
  return isComment(node) ? node.data : undefined;
}

function walk(node: Node, nodes: Node[]): Node {
  nodes.push(node);
  if (HAS_CHILDREN && getData(node)?.startsWith('n:')) {
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
    child = walk(child, nodes);
  }
  return node;
}

// The nodes of a row in document order, nested ones included.
function getNodes(range: Range): Node[] {
  const nodes: Node[] = [];
  for (let node: Node | null = range.start; node !== null; node = node.nextSibling) {
    node = walk(node, nodes);
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
// of this row's markers, so the end of a row is found by counting depth.
function readRows(start: Comment): { rows: Range[]; end: Comment } {
  const rows: Range[] = [];
  let node = start.nextSibling;
  while (isComment(node) ? node.data !== '/l' : node !== null) {
    if (isComment(node) && node.data === 'i') {
      const first = node;
      let depth = 0;
      for (; node !== null; node = node.nextSibling) {
        const data = getData(node);
        if (data === 'i') {
          depth++;
        } else if (data === '/i') {
          depth--;
        }
        if (depth === 0) {
          break;
        }
      }
      if (isComment(node)) {
        rows.push({ start: first, end: node });
      }
    }
    node = node?.nextSibling ?? null;
  }
  if (!isComment(node)) {
    throw new Error('A list has no end marker');
  }
  return { rows, end: node };
}

function removeRange(range: Range): void {
  // Children go before their parents.
  for (const block of findInnerBlocks(range.start, range.end)) {
    removeBlock(block);
  }
  // Only the top-level nodes are removed, with their subtrees.
  for (const node of getTopNodes(range)) {
    node.remove();
  }
}

function moveRange(range: Range, before: ChildNode): void {
  before.before(...getTopNodes(range));
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
  for (let j = tails.length > 0 ? tails[tails.length - 1] : -1; j >= 0; j = before[j]) {
    stay.add(j);
  }
  return stay;
}

function getRowScope(scope: Scope, item: unknown, index: number): Scope {
  return { ...scope, rows: [...scope.rows, { item, index }] };
}

// Maps the binding names inside a row to their nodes.
function findNodes(range: Range): Map<string, Node> {
  const nodes = new Map<string, Node>();
  for (const node of getNodes(range)) {
    if (isElement(node)) {
      const ids = node.getAttribute('i-a');
      for (const id of ids?.split(' ') ?? []) {
        nodes.set(`a${id}`, node);
      }
    } else if (isComment(node)) {
      const name = /^[tcl]\d+/.exec(node.data);
      if (name !== null) {
        nodes.set(name[0], node);
      }
    }
  }
  return nodes;
}

async function patchRow(
  range: Range,
  context: ListContext,
  prev: Scope,
  next: Scope,
): Promise<void> {
  let nodes: Map<string, Node> | undefined;
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
    nodes ??= findNodes(range);
    const node = nodes.get(name);
    // A binding earlier in the row may have swapped out the branch that holds this node.
    if (!node?.parentNode) {
      continue;
    }
    if (name[0] !== 'l') {
      if (HAS_ERRORS) {
        try {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          (binding as NodeBinding)(node, next);
        } catch (error) {
          if (!(await failRegion(context.page, node, error, next))) {
            throw error;
          }
          // The swap replaced the nodes of the row, so they are looked up again.
          nodes = undefined;
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

export async function patchList(...args: Parameters<PatchList>): Promise<void> {
  const [start, prev, next, context] = args;
  const { list, page } = context;

  // Pair the new items with the old rows by key. The DOM holds the old rows in order.
  // A key that is new or repeated counts as an insert.
  const oldIndexes = new Map<unknown, number>();
  for (let i = 0; i < prev.length; i++) {
    oldIndexes.set(readField(prev[i], list.key), i);
  }
  const olds: number[] = [];
  const used = new Set<number>();
  for (const item of next) {
    const old = oldIndexes.get(readField(item, list.key));
    if (old === undefined || used.has(old)) {
      olds.push(-1);
    } else {
      used.add(old);
      olds.push(old);
    }
  }

  // Load the template before the DOM changes, so a failed load leaves the list as it was.
  let chunk: ListChunk | undefined;
  if (used.size < next.length) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    chunk = (await page.load(page.manifest.module, list.chunk)) as ListChunk;
  }

  const { rows, end } = readRows(start);
  for (let i = 0; i < rows.length; i++) {
    if (!used.has(i)) {
      removeRange(rows[i]);
    }
  }

  // Render the new rows, then place all rows from the back. Kept rows in the longest stable
  // run stay where they are.
  const stay = getStayers(olds);
  const placed: Range[] = [];
  const inserts: (Node[] | undefined)[] = [];
  for (let j = 0; j < next.length; j++) {
    if (olds[j] >= 0) {
      placed.push(rows[olds[j]]);
      continue;
    }
    const scope = getRowScope(context.next, next[j], j);
    const nodes = parseHtml(
      start.ownerDocument,
      `<!--i-->${chunk?.render(scope)}<!--/i-->`,
      chunk?.namespace,
    );
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!isComment(first) || !isComment(last)) {
      throw new Error('A row has no markers');
    }
    placed.push({ start: first, end: last });
    inserts[j] = nodes;
  }
  let before: ChildNode = end;
  for (let j = next.length - 1; j >= 0; j--) {
    const row = placed[j];
    const nodes = inserts[j];
    if (nodes !== undefined) {
      before.before(...nodes);
      for (const block of findInnerBlocks(row.start, row.end)) {
        addBlock(block);
      }
    } else if (!stay.has(j)) {
      moveRange(row, before);
    }
    before = row.start;
  }

  // A chosen row binding runs on every kept row: its paths may include state outside the list.
  for (let j = 0; j < next.length; j++) {
    if (olds[j] >= 0) {
      const prevScope = getRowScope(context.prev, prev[olds[j]], olds[j]);
      const nextScope = getRowScope(context.next, next[j], j);
      await patchRow(placed[j], context, prevScope, nextScope);
    }
  }
}
