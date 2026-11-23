// A second component of the package, which the app renders on its own.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition
import type { JSX } from 'idlip/jsx-runtime';

export default function Badge(props: { text: string }): JSX.Element {
  let seen = false;

  function mark() {
    seen = true;
  }

  return (
    <button class="ui-badge" on:click={mark}>
      {seen ? `${props.text} (seen)` : props.text}
    </button>
  );
}
