// The code of the landing sample. It is the one place the source comes from, so a live editor can
// take it over later. A test compiles it and checks it against the counter of the REPL.

export const SAMPLE_FILE = 'counter.tsx';

export const SAMPLE_SOURCE = `import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  const double = count * 2;

  function increment() {
    count = count + 1;
  }
  function decrement() {
    count = count - 1;
  }

  return (
    <main>
      <button on:click={decrement}>-</button>
      <output>{count}</output>
      <button on:click={increment}>+</button>
      <p>Double: {double}</p>
    </main>
  );
}
`;
