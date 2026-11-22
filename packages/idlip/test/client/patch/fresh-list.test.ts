// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';

// One click shows the branch and changes the list inside it. The branch renders the list from
// the new model, so the list's own binding must not patch it from the old one.
const SOURCE = `
  import { For } from 'idlip';
  export default function Panel() {
    let open = false;
    let items = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
    function show() {
      open = !open;
      items = items.slice(1);
    }
    return (
      <div>
        <button on:click={show}>show</button>
        {open ? (
          <ul>
            <For each={items} key={(item) => item.id}>
              {(item) => <li>{item.label}</li>}
            </For>
          </ul>
        ) : (
          <p>closed</p>
        )}
      </div>
    );
  }
`;

describe('a list inside a branch that swaps in the same patch', () => {
  it('keeps the rows the branch rendered', async () => {
    const page = await mount(SOURCE, {});
    try {
      page.click('button');
      await page.settled();
      const labels: string[] = [];
      for (const item of page.root.querySelectorAll('li')) {
        labels.push(item.textContent);
      }
      expect(labels).toEqual(['B', 'C']);
      page.click('button');
      await page.settled();
      expect(page.root.querySelector('p')?.textContent).toBe('closed');
    } finally {
      page.stop();
    }
  });
});
