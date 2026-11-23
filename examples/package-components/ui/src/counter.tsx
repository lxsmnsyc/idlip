// A stateful component of the package. The page links its stylesheets, and a click loads its
// handler chunk from the package's own file.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';
import './counter.css';
import styles from './counter.module.css';

export default function Counter(props: { label: string; start: number }): JSX.Element {
  let count = props.start;

  function add() {
    count = count + 1;
  }

  return (
    <div class="ui-counter">
      <span>{props.label}</span>
      <button on:click={add}>+</button>
      <output class={count > 2 ? styles.high : styles.low}>{count}</output>
    </div>
  );
}
