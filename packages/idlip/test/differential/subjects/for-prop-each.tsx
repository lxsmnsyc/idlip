// A list whose `each` is a prop, with row holes that read component state.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function ForPropEach(props: {
  items: { id: string; label: string }[];
}): JSX.Element {
  let big = false;

  function grow() {
    big = !big;
  }

  return (
    <section>
      <button on:click={grow}>grow</button>
      <ul>
        <For each={props.items} key={(item) => item.id}>
          {(item) => (
            <li data-r={big ? 4 : 2}>
              {item.label} {big ? 'big' : 'small'}
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
