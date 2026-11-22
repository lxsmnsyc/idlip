// The other blocks inside cloned bodies: a `<Subscribe>` with an input in a row, a `<Try>` in a
// row and in a branch with a catch view that resets, a global listener whose message reads the
// state, and a `<template>` with holes in a row. A `<Head>` binding reads `document.head`, which
// the model pairs leave out, so `template.test.ts` mounts a cloned `<Head>`.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, require-yield, prefer-const
import { For, Subscribe, Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Item {
  id: string;
  n: number;
}

// A source that waits until its block leaves the page.
async function* idle(_input: number, signal: AbortSignal) {
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => {
      resolve();
    });
  });
}

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export default function BlockKinds(props: { items: Item[] }): JSX.Element {
  let items = props.items;
  let open = true;
  let note = 'note';
  let level = 1;

  function toggle() {
    open = !open;
  }
  function ping(value: number) {
    level = value;
  }
  function press(value: string) {
    note = value;
  }

  return (
    <div>
      <button on:click={toggle}>toggle</button>
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li>
              <Subscribe to={idle} input={item.n} key={item.n} on:value={ping} />
              <Try catch={(error) => <u>{error}</u>}>
                <span>{check(item.n)}</span>
              </Try>
              <template>
                <b>{item.id}</b> {note}
              </template>
            </li>
          )}
        </For>
      </ul>
      {open ? (
        <section>
          <window on:keydown={() => press(`${note}!`)} />
          <Try
            catch={(error, reset) => (
              <p>
                {error} <button on:click={reset}>retry</button>
              </p>
            )}
          >
            <b>{check(level)}</b>
          </Try>
        </section>
      ) : (
        <p>closed {note}</p>
      )}
    </div>
  );
}
