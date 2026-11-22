// A stateful child. `label` is a props value and `onRemove` is a message prop: the parent passes
// a callback, which compiles to a message that the child puts in its event attribute.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { label: string; onRemove: () => void }): JSX.Element {
  let count = 0;

  function increment() {
    count = count + 1;
  }

  return (
    <div>
      <span>{props.label}</span>
      <button on:click={increment}>+</button>
      <output>{count}</output>
      <button on:click={props.onRemove}>Remove</button>
    </div>
  );
}
