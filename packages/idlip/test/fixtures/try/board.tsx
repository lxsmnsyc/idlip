import { For, Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

type Shown = boolean;

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export default function Board(): JSX.Element {
  let items = [
    { id: 1, n: -1 },
    { id: 2, n: 2 },
  ];
  let shown = true satisfies Shown as Shown;
  function add(): void {
    items = [...items, { id: items.length + 1, n: 3 }];
  }
  function toggle(): void {
    shown = !shown;
  }
  return (
    <main>
      <Try
        catch={(error, reset) => (
          <p>
            Failed: {error} <button on:click={reset}>Retry</button>
          </p>
        )}
      >
        <span>{check(-1)}</span>
      </Try>
      {shown ? (
        <Try catch={(error) => <em>{error}</em>}>
          <b>{check(3)}</b>
        </Try>
      ) : (
        <i>hidden</i>
      )}
      <ul>
        <For each={items} key={(item) => item.id}>
          {(item) => (
            <li>
              <Try catch={(error, reset) => <button on:click={reset}>{error}</button>}>
                <span>{check(item.n)}</span>
              </Try>
            </li>
          )}
        </For>
      </ul>
      <button on:click={add}>add</button>
      <button on:click={toggle}>toggle</button>
    </main>
  );
}
