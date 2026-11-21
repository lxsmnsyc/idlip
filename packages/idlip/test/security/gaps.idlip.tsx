// URL attributes that are not named like a URL: SVG animation targets and embedded documents.
// oxlint-disable no-script-url, typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';

export default function Gaps(props: { url: string; name: string }): JSX.Element {
  let url = props.url;

  function set(next: string) {
    url = next;
  }

  return (
    <main>
      <button on:click={() => set('javascript:alert(1)')}>evil</button>
      <button on:click={() => set('data:text/html,<script>alert(1)</script>')}>html</button>
      <button on:click={() => set('data:image/png;base64,AAAA')}>image</button>
      <svg>
        <a id="a">
          <animate id="to" attributeName="href" to={url} />
          <animate id="from" attributeName="xlink:href" from={url} />
          <animate id="by" attributeName="HREF" by={url} />
          <set id="set" attributeName="href" to={url} />
          <animate id="values" attributeName="href" values={url} />
          <animate id="dyn" attributeName={props.name} to={url} />
          <animate id="plain" attributeName="opacity" to={url} />
        </a>
      </svg>
      <iframe id="iframe" src={url} />
      <object id="object" data={url} />
      <embed id="embed" src={url} />
      <img id="img" src={url} />
    </main>
  );
}
