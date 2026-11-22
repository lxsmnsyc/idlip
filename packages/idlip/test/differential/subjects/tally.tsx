// A stateful child whose view clones with a condition and a list in it.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Tally(props: { label: string; onRemove: () => void }): JSX.Element {
  let marks = [] satisfies number[] as number[];

  function mark() {
    marks = [...marks, marks.length + 1];
  }
  function clear() {
    marks = [];
  }

  return (
    <div title={props.label}>
      <button on:click={mark}>{props.label}</button>
      {marks.length > 0 ? <button on:click={clear}>clear</button> : <span>none</span>}
      <For each={marks} key={(n) => n}>
        {(n) => <u>{n}</u>}
      </For>
      <button on:click={props.onRemove}>remove</button>
    </div>
  );
}
