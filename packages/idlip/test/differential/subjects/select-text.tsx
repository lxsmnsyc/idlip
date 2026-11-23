// Text holes directly inside a `select`, in cloned rows and a cloned branch, and table rows and
// cells. The parser keeps text and comments in a select, and the compiler rejects text directly
// inside a table, so the template marks these holes with comments as anywhere else.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
}

export default function SelectText(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let open = true;
  let note = 'note';

  function toggle() {
    open = !open;
  }

  return (
    <div>
      <button on:click={toggle}>toggle</button>
      <For each={items} key={(item) => item.id}>
        {(item) => (
          <select name={item.id}>
            {item.label}
            <option value={item.id}>{item.label}</option>
            {note}
          </select>
        )}
      </For>
      {open ? (
        <select>
          {note} {items.length}
          <option>one</option>
        </select>
      ) : (
        <p>{note}</p>
      )}
      <table>
        <colgroup>
          <col title={`${items.length} columns`} />
        </colgroup>
        <tbody>
          <For each={items} key={(item) => item.id}>
            {(item) => (
              <tr>
                <td>{item.label}</td>
                <td>{note}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
