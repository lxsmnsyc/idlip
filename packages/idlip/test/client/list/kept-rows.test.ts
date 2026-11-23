// @vitest-environment happy-dom
// Kept rows: every chosen row binding runs on each of them, and a row reuses the nodes it found
// on an earlier patch until a block is added. `settled()` compares the page with a server render
// of the model after each click. The counts of `i-a` reads show how many times rows were walked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

// The index, when a row shows it, reads the list path, which changes with every list change.
function makeSource(key: string, index = false): string {
  return `import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Row {
  id: number;
  label: string;
  open: boolean;
  tags: { id: number; name: string }[];
}

export default function App(props: { rows: Row[] }): JSX.Element {
  let rows = props.rows;
  let selected = 0;
  let title = 'T';

  function select(id: number) {
    selected = id;
  }
  function toggle(id: number) {
    rows = rows.map((r) => (r.id === id ? { ...r, open: !r.open } : r));
  }
  function rename(id: number) {
    rows = rows.map((r) => (r.id === id ? { ...r, label: r.label + '!' } : r));
  }
  function removeFirst() {
    rows = rows.slice(1);
  }
  function swap() {
    rows = [rows[2], rows[1], rows[0]];
  }
  function retitle() {
    title = title + '!';
  }

  return (
    <main>
      <button id="remove" on:click={() => removeFirst()}>remove</button>
      <button id="swap" on:click={() => swap()}>swap</button>
      <button id="retitle" on:click={() => retitle()}>retitle</button>
      <ul>
        <For each={rows} key={${key}}>
          {(r${index ? ', i' : ''}) => (
            <li class={selected === r.id ? 'on' : ''} data-label={r.label}>
              ${index ? '<span class="index">{i}</span>' : ''}
              <a class="select" on:click={() => select(r.id)}>{r.label}</a>
              <a class="toggle" on:click={() => toggle(r.id)}>toggle</a>
              <a class="rename" on:click={() => rename(r.id)}>rename</a>
              <em>{rows.find((x) => x.id === selected)?.label}</em>
              {r.open ? (
                <p>
                  <b data-open={r.label}>{r.label}</b>
                </p>
              ) : (
                <i data-closed={r.label}>closed</i>
              )}
              <ol>
                <For each={r.tags} key={(t) => t.id}>
                  {(t) => (
                    <li class="tag">
                      {title} {r.label} {t.name}
                    </li>
                  )}
                </For>
              </ol>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
`;
}

const KEYS = [
  { name: 'a field key', key: '(r) => r.id' },
  { name: 'a computed key', key: '(r) => `k${r.id}`' },
];

function makeRows(): object[] {
  const rows: object[] = [];
  for (const id of [1, 2, 3]) {
    rows.push({ id, label: `r${id}`, open: true, tags: [{ id: 10 + id, name: `n${id}` }] });
  }
  return rows;
}

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  vi.restoreAllMocks();
});

async function clickRow(mounted: MountedPage, row: number, name: string): Promise<void> {
  mounted.click(`ul > li:nth-child(${row}) a.${name}`);
  await mounted.settled();
}

function readTexts(mounted: MountedPage, selector: string): string[] {
  const texts: string[] = [];
  for (const node of mounted.root.querySelectorAll(selector)) {
    texts.push(node.textContent.trim());
  }
  return texts;
}

/** Counts the `setAttribute` calls for each attribute name from now on. */
function countWrites(): Map<string, number> {
  const counts = new Map<string, number>();
  const original = Element.prototype.setAttribute;
  vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function write(
    this: Element,
    name: string,
    value: string,
  ) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
    original.call(this, name, value);
  });
  return counts;
}

/** Counts the reads of `i-a` from now on: each element of a walked row reads it once. */
function countWalks(): { reads: number } {
  const count = { reads: 0 };
  const original = Element.prototype.getAttribute;
  vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function read(
    this: Element,
    name: string,
  ) {
    if (name === 'i-a') {
      count.reads++;
    }
    return original.call(this, name);
  });
  return count;
}

describe.each(KEYS)('kept rows with $name', ({ key }) => {
  const source = makeSource(key);

  it('runs a binding that reads state outside the item on every kept row', async () => {
    page = await mount(source, { rows: makeRows() });
    await clickRow(page, 2, 'select');
    const writes = countWrites();
    await clickRow(page, 3, 'select');
    expect(readTexts(page, 'ul > li.on > a.select')).toEqual(['r3']);
    expect(writes.get('class')).toBe(3);
  });

  it('patches a row whose item changed', async () => {
    page = await mount(source, { rows: makeRows() });
    await clickRow(page, 2, 'rename');
    expect(readTexts(page, 'ul > li > a.select')).toEqual(['r1', 'r2!', 'r3']);
  });

  it('writes a keyed path outside the item on every kept row', async () => {
    page = await mount(source, { rows: makeRows() });
    await clickRow(page, 2, 'select');
    expect(readTexts(page, 'em')).toEqual(['r2', 'r2', 'r2']);
    // The selected row's label changes: the rows with the same items read it too.
    await clickRow(page, 2, 'rename');
    expect(readTexts(page, 'em')).toEqual(['r2!', 'r2!', 'r2!']);
  });

  it('writes the index of rows that moved with the same item', async () => {
    page = await mount(makeSource(key, true), { rows: makeRows() });
    page.click('#remove');
    await page.settled();
    expect(readTexts(page, 'span.index')).toEqual(['0', '1']);
  });

  it('keeps swapped rows', async () => {
    page = await mount(source, { rows: makeRows() });
    page.click('#swap');
    await page.settled();
    expect(readTexts(page, 'ul > li > a.select')).toEqual(['r3', 'r2', 'r1']);
  });

  it('patches rows of a nested list whose outer item changed', async () => {
    page = await mount(source, { rows: makeRows() });
    await clickRow(page, 2, 'rename');
    expect(readTexts(page, 'li.tag')).toEqual(['T r1 n1', 'T r2! n2', 'T r3 n3']);
    page.click('#retitle');
    await page.settled();
    expect(readTexts(page, 'li.tag')).toEqual(['T! r1 n1', 'T! r2! n2', 'T! r3 n3']);
  });

  it('finds the nodes of a branch that a later patch rendered again', async () => {
    page = await mount(source, { rows: makeRows() });
    // The first rename finds the row's nodes, then the branch closes and opens again: the nodes
    // found first are out of the page, though the text marker still has a parent.
    await clickRow(page, 1, 'rename');
    await clickRow(page, 1, 'toggle');
    await clickRow(page, 1, 'toggle');
    await clickRow(page, 1, 'rename');
    expect(page.get('ul > li:nth-child(1) b').textContent).toBe('r1!!');
  });

  it('walks a row once while no block is added', async () => {
    page = await mount(source, { rows: makeRows() });
    // Close the branch of row 1, so its `data-open` binding is absent from the row's nodes.
    await clickRow(page, 1, 'toggle');
    await clickRow(page, 1, 'rename');
    const walks = countWalks();
    await clickRow(page, 1, 'rename');
    await clickRow(page, 1, 'rename');
    expect(page.get('ul > li:nth-child(1) i').getAttribute('data-closed')).toBe('r1!!!');
    expect(walks.reads).toBe(0);
  });
});

// A row that reads other items of its own list: `rows[first]` and a `find` over the list give
// paths under `rows.*`, the same paths as the row's own item.
const CROSS = `import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function App(props: { rows: { id: number; label: string }[] }): JSX.Element {
  let rows = props.rows;
  let first = 0;

  function swap() {
    rows = [rows[2], rows[1], rows[0]];
  }
  function rename() {
    rows = rows.map((r) => (r.id === 3 ? { ...r, label: r.label + '!' } : r));
  }
  function pick() {
    first = 1;
  }

  return (
    <main>
      <button id="swap" on:click={() => swap()}>swap</button>
      <button id="rename" on:click={() => rename()}>rename</button>
      <button id="pick" on:click={() => pick()}>pick</button>
      <ul>
        <For each={rows} key={(r) => r.id}>
          {(r) => (
            <li>
              <b>{rows[first]?.label}</b>
              <i>{rows.find((x) => x.label === r.label)?.id}</i>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
`;

function makeCrossRows(): object[] {
  return [
    { id: 1, label: 'a' },
    { id: 2, label: 'b' },
    { id: 3, label: 'c' },
  ];
}

describe('rows that read other items of their list', () => {
  it('writes an indexed item on rows with the same item after a swap', async () => {
    page = await mount(CROSS, { rows: makeCrossRows() });
    page.click('#swap');
    await page.settled();
    expect(readTexts(page, 'b')).toEqual(['c', 'c', 'c']);
  });

  it('writes an indexed item on rows with the same item after another item changed', async () => {
    page = await mount(CROSS, { rows: makeCrossRows() });
    page.click('#swap');
    await page.settled();
    page.click('#rename');
    await page.settled();
    expect(readTexts(page, 'b')).toEqual(['c!', 'c!', 'c!']);
  });
});
