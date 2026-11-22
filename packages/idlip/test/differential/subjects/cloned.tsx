// Rows and branches that render by a cloned template: holes next to static text, empty text,
// class objects, boolean, URL and form attributes, event messages that read the row, a row in
// a table, and a disclosure whose branches both clone.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
  url: string;
  done: boolean;
  n: number;
}

export default function Cloned(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let open = false;
  let title = 'Details';
  let note = '';
  let picked = '';

  function toggle() {
    open = !open;
  }
  function pick(id: string) {
    picked = id;
  }

  return (
    <div>
      <button on:click={toggle}>toggle</button>
      {open ? (
        <section class={{ open, empty: note === '' }}>
          <h2>{title}</h2>
          <p>
            Note: {note} ({picked})
          </p>
          <button on:click={() => pick(title)}>pick</button>
        </section>
      ) : (
        <p title={title}>closed {note}</p>
      )}
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li class={{ done: item.done, picked: picked === item.id }} data-n={item.n}>
              <input type="checkbox" checked={item.done} value={item.label} disabled={item.done} />
              <a href={item.url} on:click={() => pick(item.id)}>
                {item.label}
              </a>
              <span>
                {item.n} of {item.label}!
              </span>
            </li>
          )}
        </For>
      </ul>
      <table>
        <tbody>
          <For each={items} key={(item) => item.id}>
            {(item) => (
              <tr class={picked === item.id ? 'danger' : ''}>
                <td>{item.id}</td>
                <td>{item.label}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
