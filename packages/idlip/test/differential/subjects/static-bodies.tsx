// Bodies with nothing to write, which clone their parsed template as it is: static rows, a
// static branch and an empty one, a static branch inside a row, and a static catch view.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For, Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  on: boolean;
}

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export default function StaticBodies(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let open = false;
  let level = 1;

  function toggle() {
    open = !open;
  }

  return (
    <div>
      <button on:click={toggle}>toggle</button>
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li>
              static <b>row</b>
              {item.on ? <i>on</i> : <i>off</i>}
            </li>
          )}
        </For>
      </ul>
      <ol>
        <For each={items} key={(item) => item.id}>
          {(_item) => <li>plain</li>}
        </For>
      </ol>
      {open ? <p>open</p> : <p>closed</p>}
      {open && <hr />}
      <Try catch={(_error) => <em>failed</em>}>
        <span>{check(level)}</span>
      </Try>
    </div>
  );
}
