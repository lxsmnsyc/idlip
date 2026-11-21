// A <Try> catch view inside <svg>.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Boxed(props: { n: number }): JSX.Element {
  return (
    <svg>
      <Try catch={(error) => <text>{error}</text>}>
        <circle r={props.n} />
      </Try>
    </svg>
  );
}
