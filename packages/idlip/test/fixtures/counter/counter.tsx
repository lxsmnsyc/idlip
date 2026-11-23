// Handlers and event arrows follow docs/proposals/0002-modules.md, which has no return types.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  const even = count % 2 === 0;

  function increment() {
    count = count + 1;
  }
  function add(step: number) {
    count = count + step;
  }
  function reset() {
    count = props.start;
  }

  return (
    <div>
      <button on:click={increment}>+1</button>
      <button on:click={() => add(10)}>+10</button>
      <button on:click={reset}>Reset</button>
      <output class={{ even }}>{count}</output>
      {even && <span>even</span>}
    </div>
  );
}
