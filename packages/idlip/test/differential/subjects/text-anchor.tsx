// Bound text that is the only child of an element, which patches through the element's `i-a`:
// at the top level, on an element with an attribute and an event, in a branch, in rows and in
// SVG. A `pre` keeps its markers, and a hole with a sibling keeps them too.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
}

export default function TextAnchor(props: { title: string; items: Item[] }): JSX.Element {
  let title = props.title;
  let items = props.items;
  let open = true;
  let picked = '';

  function toggle() {
    open = !open;
  }
  function pick(id: string) {
    picked = id;
  }

  return (
    <main>
      <h1>{title}</h1>
      <b class={picked === '' ? 'none' : 'some'} on:click={toggle}>
        {picked}
      </b>
      <p>
        {title}
        {picked}
      </p>
      <pre>{title}</pre>
      {open ? <strong>{title}</strong> : <em>{picked}</em>}
      <select>
        <option>{title}</option>
      </select>
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li on:click={() => pick(item.id)}>
              <span>{item.label}</span>
              <svg viewBox="0 0 4 4">
                <text>{item.label}</text>
              </svg>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
