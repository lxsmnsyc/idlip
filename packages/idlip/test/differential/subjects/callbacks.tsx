// Event arrows that call two handlers, branch on a row, and read the event and the element.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  label: string;
  picked: boolean;
}

function countPicked(items: readonly Item[]): number {
  let total = 0;
  for (const item of items) {
    if (item.picked) {
      total++;
    }
  }
  return total;
}

export default function Callbacks(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let draft = '';
  let log = '';
  let next = props.items.length + 1;

  const picked = countPicked(items);

  function pick(id: string) {
    items = items.map((i) => (i.id === id ? { ...i, picked: !i.picked } : i));
  }
  function note(text: string) {
    log = text;
  }
  function remove(id: string) {
    items = items.filter((i) => i.id !== id);
  }
  function setDraft(text: string) {
    draft = text;
  }
  function add(text: string) {
    items = [...items, { id: `n${next}`, label: text, picked: false }];
    next = next + 1;
  }

  return (
    <main>
      <p>
        {picked} picked, {log}
      </p>
      <input
        value={draft}
        on:input={(e) => setDraft(e.currentTarget.value)}
        on:keydown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
          }
          const text = e.currentTarget.value;
          if (e.key === 'Enter' && text !== '') {
            add(text);
            setDraft('');
          } else {
            note(e.key);
          }
        }}
      />
      <ul>
        <For each={items} key={(i) => i.id}>
          {(i) => (
            <li>
              <button
                on:click={() => {
                  pick(i.id);
                  note(i.label);
                }}
              >
                {i.label}
              </button>
              <button
                on:click={() => {
                  if (i.picked) {
                    remove(i.id);
                  } else {
                    note(`kept ${i.id}`);
                  }
                }}
              >
                x
              </button>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
