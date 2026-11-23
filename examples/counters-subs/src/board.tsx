// A document with a list of `Counter` children and a remove button each. Each row child is slotted by its key.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Counter from './counter.tsx';

interface Item {
  id: string;
  label: string;
  start: number;
}

export default function Board(props: { items: Item[] }): JSX.Element {
  let items = props.items;

  const total = items.length;

  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>counters</title>
      </head>
      <body>
        <main>
          <p>{total} counters</p>
          <For each={items} key={(c) => c.id}>
            {(c) => <Counter label={c.label} start={c.start} onRemove={() => remove(c.id)} />}
          </For>
        </main>
      </body>
    </html>
  );
}
