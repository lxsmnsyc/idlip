// Holes that read the length of a string: one on the state at the top level and one in a row.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
}

export default function StringLength(props: { items: Item[] }): JSX.Element {
  let draft = '';
  let items = props.items;

  function type() {
    draft = `${draft}ab`;
  }
  function grow() {
    items = items.map((item) => ({ ...item, label: `${item.label}!` }));
  }

  return (
    <div>
      <button on:click={type}>{draft.length}</button>
      <button on:click={grow}>grow</button>
      <For each={items} key={(item) => item.id}>
        {(item) => <p>{item.label.length}</p>}
      </For>
    </div>
  );
}
