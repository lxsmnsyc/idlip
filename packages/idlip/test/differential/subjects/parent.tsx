// A parent whose children come and go: in a keyed list, in a condition and as a spare. Each
// handler changes the parent model only, so the server can render the whole page again.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Counter from './counter.tsx';

interface Item {
  id: string;
  label: string;
}

export default function Parent(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let spare = true;
  let heading = 'Counters';

  function add() {
    items = [...items, { id: `n${items.length + 1}`, label: `Item ${items.length + 1}` }];
  }
  function relabel() {
    items = items.map((item) => ({ ...item, label: `${item.label}!` }));
  }
  function reverse() {
    items = items.toReversed();
  }
  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }
  function toggle() {
    spare = !spare;
  }
  function rename() {
    heading = `${heading} <${items.length}>`;
  }

  return (
    <section>
      <h2>{heading}</h2>
      <button on:click={add}>add</button>
      <button on:click={relabel}>relabel</button>
      <button on:click={reverse}>reverse</button>
      <button on:click={toggle}>toggle</button>
      <button on:click={rename}>rename</button>
      {spare ? <Counter label="Spare" onRemove={toggle} /> : <p>no spare</p>}
      <For each={items} key="id">
        {(item) => <Counter label={item.label} onRemove={() => remove(item.id)} />}
      </For>
    </section>
  );
}
