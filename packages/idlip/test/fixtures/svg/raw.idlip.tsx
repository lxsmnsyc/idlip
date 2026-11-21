// Raw HTML through html={trusted(...)}, in the page, in a row and in an svg.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For, trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Raw(props: { note: string }): JSX.Element {
  let note = props.note;
  let rows = [{ id: 'a1', body: '<i>one</i>' }];

  function setNote(value: string) {
    note = value;
  }
  function addRow() {
    rows = [...rows, { id: 'a2', body: '<b>two</b>' }];
  }

  return (
    <main>
      <button on:click={() => setNote('<em>new</em>')}>set</button>
      <button on:click={() => addRow()}>row</button>
      <div html={trusted(note)} />
      <ul>
        <For each={rows} key="id">
          {(r) => <li html={trusted(r.body)} />}
        </For>
      </ul>
      <svg>
        <g html={trusted('<circle r="1"/>')} />
      </svg>
    </main>
  );
}
