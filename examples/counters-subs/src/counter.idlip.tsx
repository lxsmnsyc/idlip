// A stateful child. `label` and `start` are props values, and `onRemove` is a message prop: the
// parent passes a callback, which compiles to a message that the child puts in its event attribute.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { Subscribe } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

// A source that waits until its block leaves the page. It never yields, so it only shows that a
// child's source chunk loads from the child's module.
async function* idle(_input: number, signal: AbortSignal) {
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => {
      resolve();
    });
  });
  yield 0;
}

export default function Counter(props: {
  label: string;
  start: number;
  onRemove: () => void;
}): JSX.Element {
  let count = props.start;

  function increment() {
    count = count + 1;
  }

  function ping(value: number) {
    count = value;
  }

  return (
    <div>
      <span>{props.label}</span>
      <button on:click={increment}>+</button>
      <output>{count}</output>
      <button on:click={props.onRemove}>Remove</button>
      <Subscribe to={idle} input={1} on:value={ping} />
    </div>
  );
}
