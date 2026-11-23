// An app that uses components from the `@idlip-example/ui` package, in a list and on their own.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Badge from '@idlip-example/ui/badge.tsx';
import Counter from '@idlip-example/ui/counter.tsx';

interface Item {
  id: string;
  label: string;
  start: number;
}

export default function App(props: { items: Item[] }): JSX.Element {
  let items = props.items;

  function clear() {
    items = [];
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>package components</title>
      </head>
      <body>
        <main>
          <Badge text="from a package" />
          <For each={items} key={(item) => item.id}>
            {(item) => <Counter label={item.label} start={item.start} />}
          </For>
          <button on:click={clear}>Clear</button>
        </main>
      </body>
    </html>
  );
}
