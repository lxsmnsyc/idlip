// Three components in one file: the default export `Dashboard`, the named export `Counter` and
// the private `Row`. Each has its own model, chunks and manifest. `Dashboard` renders both.
// oxlint-disable typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
}

export function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  function increment() {
    count = count + 1;
  }

  return (
    <div class="counter">
      <button on:click={increment}>+</button>
      <output>{count}</output>
    </div>
  );
}

function Row(props: { label: string }): JSX.Element {
  let done = false;

  function toggle() {
    done = !done;
  }

  return (
    <li class={{ done }}>
      <button on:click={toggle}>{props.label}</button>
    </li>
  );
}

export default function Dashboard(props: { items: Item[] }): JSX.Element {
  let title = 'Widgets';

  function rename() {
    title = `${title}!`;
  }

  return (
    <main>
      <h1 on:click={rename}>{title}</h1>
      <Counter start={1} />
      <ul>
        <For each={props.items} key={(item) => item.id}>
          {(item) => <Row label={item.label} />}
        </For>
      </ul>
    </main>
  );
}
