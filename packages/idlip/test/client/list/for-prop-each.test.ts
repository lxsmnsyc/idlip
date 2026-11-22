// @vitest-environment happy-dom
// A row hole that reads component state updates when `each` is a prop.
import { afterEach, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const SOURCE = `import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function App(props: { items: { id: number; label: string }[] }): JSX.Element {
  let big = false;

  function grow() {
    big = !big;
  }

  return (
    <section>
      <button on:click={grow}>grow</button>
      <ul>
        <For each={props.items} key={(item) => item.id}>
          {(item) => <li data-r={big ? 4 : 2}>{item.label} {big ? 'big' : 'small'}</li>}
        </For>
      </ul>
    </section>
  );
}
`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

it('updates row holes that read state when each is a prop', async () => {
  page = await mount(SOURCE, {
    items: [
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ],
  });
  page.click('button');
  await page.settled();
  const li = page.root.querySelector('li');
  expect(li?.getAttribute('data-r')).toBe('4');
  expect(li?.textContent).toContain('big');
});
