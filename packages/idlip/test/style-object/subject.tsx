// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function StyleObject(props: {
  size: number;
  rows: { id: string; color: string }[];
}): JSX.Element {
  let size = props.size;
  let display = null satisfies string | null as string | null;

  function grow() {
    size = size + 1;
    display = 'none';
  }

  return (
    <div>
      <p id="static" style={{ color: 'red', backgroundColor: '#fff', margin: 0, '--gap': '4px' }} />
      <p id="dropped" style={{ color: 'blue', top: null, left: false }} />
      <p id="text" style="color: green" />
      <p id="dynamic" style={{ '--size': size, fontSize: `${size}px`, display }} />
      <ul>
        <For each={props.rows} key={(row) => row.id}>
          {(row) => <li style={{ color: row.color, marginTop: size }} />}
        </For>
      </ul>
      <button on:click={grow}>grow</button>
    </div>
  );
}
