// @ts-nocheck: the JSX types lack formaction on button and xlink:href on svg a (jsx-types).
// oxlint-disable no-script-url
// URL attributes bound from the model, and one static literal.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';

export default function Links(props: { url: string }): JSX.Element {
  let url = props.url;

  function evil() {
    url = 'javascript:alert(1)';
  }
  function good() {
    url = '/ok';
  }

  return (
    <main>
      <button on:click={() => evil()}>evil</button>
      <button on:click={() => good()}>good</button>
      <a id="html" href={url}>
        link
      </a>
      <a id="static" href="javascript:void(0)">
        static
      </a>
      <form action={url}>
        <button id="fa" formaction={url}>
          go
        </button>
      </form>
      <svg>
        <a id="svg" href={url}>
          <text>x</text>
        </a>
        <a id="xlink" xlink:href={url}>
          <text>y</text>
        </a>
      </svg>
    </main>
  );
}
