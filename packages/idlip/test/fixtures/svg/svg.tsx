// A list and a condition inside <svg> and <math>, and a foreignObject that returns to HTML.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Shapes(props: { first: string }): JSX.Element {
  let dots = [{ id: 'a1', r: props.first }];
  let shown = props.first === 'show';
  let terms = [{ id: 'm1', name: 'x' }];

  function addDot() {
    dots = [...dots, { id: 'a2', r: '4' }];
  }
  function toggle() {
    shown = !shown;
  }
  function addTerm() {
    terms = [...terms, { id: 'm2', name: 'y' }];
  }

  return (
    <main>
      <button on:click={() => addDot()}>dot</button>
      <button on:click={() => toggle()}>toggle</button>
      <button on:click={() => addTerm()}>term</button>
      <svg viewBox="0 0 10 10">
        <For each={dots} key={(d) => d.id}>
          {(d) => <circle r={d.r} />}
        </For>
        {shown && <rect width="2" height="2" />}
        <foreignObject>
          <div>{shown && <span>html</span>}</div>
        </foreignObject>
      </svg>
      <math>
        <mrow>
          <For each={terms} key={(t) => t.id}>
            {(t) => <mi>{t.name}</mi>}
          </For>
        </mrow>
      </math>
    </main>
  );
}
