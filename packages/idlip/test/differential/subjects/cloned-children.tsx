// Children inside cloned bodies: next to elements and holes in a row, inside a condition of a
// row, and in a list inside a branch. The child's view clones too, with a condition and a list.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Tally from './tally.tsx';

interface Item {
  id: string;
  label: string;
  on: boolean;
}

export default function ClonedChildren(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let open = true;

  function add() {
    items = [...items, { id: `n${items.length + 1}`, label: `Item ${items.length + 1}`, on: true }];
  }
  function flip() {
    items = items.map((item) => ({ ...item, on: !item.on }));
  }
  function reverse() {
    items = items.toReversed();
  }
  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }
  function toggle() {
    open = !open;
  }

  return (
    <section>
      <button on:click={add}>add</button>
      <button on:click={flip}>flip</button>
      <button on:click={reverse}>reverse</button>
      <button on:click={toggle}>toggle</button>
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li class={{ on: item.on }}>
              <b>{item.label}</b>
              {item.on ? <Tally label={item.label} onRemove={() => remove(item.id)} /> : <i>off</i>}
            </li>
          )}
        </For>
      </ul>
      {open ? (
        <div>
          <h3>{items.length} open</h3>
          <For each={items} key={(item) => item.id}>
            {(item) => <Tally label={`${item.label} copy`} onRemove={toggle} />}
          </For>
        </div>
      ) : (
        <p>closed</p>
      )}
    </section>
  );
}
