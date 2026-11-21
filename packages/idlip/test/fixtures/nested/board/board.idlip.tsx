// A parent with two kinds of child slot: `Spare` is the first child site in the source, so its
// slot is its position, and the row children of the keyed `<For>` are slotted by the loop key.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Counter from '../counter/counter.idlip.tsx';

interface Item {
  id: string;
  label: string;
}

export default function Board(props: { items: Item[] }): JSX.Element {
  let items = props.items;

  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }
  function clearAll() {
    items = [];
  }

  return (
    <section>
      <p>{items.length} counters</p>
      <Counter label="Spare" onRemove={clearAll} />
      <For each={items} key="id">
        {(c) => <Counter label={c.label} onRemove={() => remove(c.id)} />}
      </For>
    </section>
  );
}
