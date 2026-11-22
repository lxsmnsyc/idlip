// Lists whose key is not one field of the item: a template literal, and a nested field. Rows
// move by key, and a handler changes the order, the rows and one row.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Entry {
  kind: string;
  id: number;
  label: string;
  done: boolean;
  meta: { id: string };
}

export default function ComputedKey(props: { entries: Entry[] }): JSX.Element {
  let entries = props.entries;
  let heading = 'Entries';

  function reverse() {
    entries = entries.toReversed();
  }
  function add() {
    entries = [
      ...entries,
      {
        kind: 'n',
        id: entries.length + 1,
        label: `New ${entries.length + 1}`,
        done: false,
        meta: { id: `m${entries.length + 1}` },
      },
    ];
  }
  function toggle(kind: string, id: number) {
    entries = entries.map((entry) =>
      entry.kind === kind && entry.id === id ? { ...entry, done: !entry.done } : entry,
    );
  }
  function rename() {
    heading = `${heading}!`;
  }

  return (
    <section>
      <h2>{heading}</h2>
      <button on:click={reverse}>reverse</button>
      <button on:click={add}>add</button>
      <button on:click={rename}>rename</button>
      <ul>
        <For each={entries} key={(entry) => `${entry.kind}:${entry.id}`}>
          {(entry) => (
            <li class={{ done: entry.done }}>
              <button on:click={() => toggle(entry.kind, entry.id)}>{entry.label}</button>
            </li>
          )}
        </For>
      </ul>
      <ol>
        <For each={entries} key={(entry) => entry.meta.id}>
          {(entry) => <li>{entry.label}</li>}
        </For>
      </ol>
    </section>
  );
}
