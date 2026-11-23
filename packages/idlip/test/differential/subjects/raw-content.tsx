// Raw HTML inside cloned bodies: the element clones and only its content is parsed. Next to
// holes and a bound attribute in a row, in a branch, in SVG rows, and an empty value.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For, trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Row {
  id: string;
  body: string;
  label: string;
}

export default function RawContent(props: { rows: Row[] }): JSX.Element {
  let rows = props.rows;
  let open = true;
  let note = '<em>note</em> &amp; <b>more</b>';

  function toggle() {
    open = !open;
  }

  return (
    <main>
      <button on:click={toggle}>toggle</button>
      <ul>
        <For each={rows} key={(row) => row.id}>
          {(row) => (
            <li title={row.label}>
              <b>{row.label}</b>
              <div class="body" html={trusted(row.body)} />
              {row.label}
            </li>
          )}
        </For>
      </ul>
      {open ? (
        <section>
          <p html={trusted(note)} />
          <span>{rows.length}</span>
        </section>
      ) : (
        <p>closed</p>
      )}
      <svg>
        <For each={rows} key={(row) => row.id}>
          {(row) => <g data-id={row.id} html={trusted(`<text>${row.id}</text>`)} />}
        </For>
      </svg>
    </main>
  );
}
