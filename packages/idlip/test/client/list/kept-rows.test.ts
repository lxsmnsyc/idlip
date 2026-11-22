// @vitest-environment happy-dom
// Kept rows whose item did not change: the patch skips them unless a binding reads a changed
// path outside the item, and it reuses the nodes it found in a row on an earlier patch.
// `settled()` compares the page with a server render of the model after each click.
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const SOURCE = `import { For } from 'idlip';
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
        <For each={rows} key={(r) => r.id}>
          {(r, i) => (
            <li class={selected === r.id ? 'on' : ''}>
              <span class="index">{i}</span>
              <a class="select" on:click={() => select(r.id)}>{r.label}</a>
              <a class="toggle" on:click={() => toggle(r.id)}>toggle</a>
              <a class="rename" on:click={() => rename(r.id)}>rename</a>
              {r.open ? (
                <p>
                  <b>{r.label}</b>
                </p>
              ) : (
                <i>closed</i>
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

describe('kept rows', () => {
  it('runs a binding that reads state outside the item on every kept row', async () => {
    page = await mount(SOURCE, { rows: makeRows() });
    await clickRow(page, 2, 'select');
    await clickRow(page, 3, 'select');
    expect(readTexts(page, 'ul > li.on > a.select')).toEqual(['r3']);
  });

  it('writes the index of rows that moved with the same item', async () => {
    page = await mount(SOURCE, { rows: makeRows() });
    page.click('#remove');
    await page.settled();
    expect(readTexts(page, 'span.index')).toEqual(['0', '1']);
  });

  it('keeps swapped rows with the same items', async () => {
    page = await mount(SOURCE, { rows: makeRows() });
    page.click('#swap');
    await page.settled();
    expect(readTexts(page, 'ul > li > a.select')).toEqual(['r3', 'r2', 'r1']);
    expect(readTexts(page, 'span.index')).toEqual(['0', '1', '2']);
  });

  it('patches rows of a nested list whose outer item changed', async () => {
    page = await mount(SOURCE, { rows: makeRows() });
    await clickRow(page, 2, 'rename');
    expect(readTexts(page, 'li.tag')).toEqual(['T r1 n1', 'T r2! n2', 'T r3 n3']);
    page.click('#retitle');
    await page.settled();
    expect(readTexts(page, 'li.tag')).toEqual(['T! r1 n1', 'T! r2! n2', 'T! r3 n3']);
  });

  it('finds the nodes of a branch that a later patch rendered again', async () => {
    page = await mount(SOURCE, { rows: makeRows() });
    // The first rename finds the row's nodes, then the branch closes and opens again: the nodes
    // found first are out of the page, though the text marker still has a parent.
    await clickRow(page, 1, 'rename');
    await clickRow(page, 1, 'toggle');
    await clickRow(page, 1, 'toggle');
    await clickRow(page, 1, 'rename');
    expect(page.get('ul > li:nth-child(1) b').textContent).toBe('r1!!');
  });
});
