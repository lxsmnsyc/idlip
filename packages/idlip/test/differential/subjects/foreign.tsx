// Bodies in SVG and MathML that clone: rows with holes and bound attributes, a branch with a
// hole and a nested list, a row with a foreignObject that returns to HTML, an SVG `title` with
// a hole, and MathML rows with a condition.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, typescript/no-deprecated, prefer-const
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Dot {
  id: string;
  r: number;
  label: string;
}

export default function Foreign(props: { title: string }): JSX.Element {
  let dots = [
    { id: 'a1', r: 2, label: 'one' },
    { id: 'a2', r: 3, label: '<two>' },
  ] satisfies Dot[] as Dot[];
  let shown = true;
  let terms = [{ id: 'm1', name: 'x', sup: true }];

  function toggle() {
    shown = !shown;
  }
  function grow() {
    dots = dots.map((dot) => ({ ...dot, r: dot.r + 1 }));
  }

  return (
    <main>
      <button on:click={toggle}>toggle</button>
      <button on:click={grow}>grow</button>
      <svg viewBox="0 0 10 10">
        <title>{props.title}</title>
        <For each={dots} key={(dot) => dot.id}>
          {(dot) => (
            <g class={{ big: dot.r > 3 }}>
              <circle r={dot.r} />
              <text>{dot.label}</text>
              <foreignObject>
                <p>
                  {dot.label} <b>{dot.r}</b>
                </p>
              </foreignObject>
            </g>
          )}
        </For>
        {shown ? (
          <g>
            <text>{dots.length} dots</text>
            <For each={dots} key={(dot) => dot.id}>
              {(dot) => <rect width={dot.r} height="1" />}
            </For>
          </g>
        ) : (
          <text>hidden {dots.length}</text>
        )}
      </svg>
      <math>
        <mrow>
          <For each={terms} key={(term) => term.id}>
            {(term) => (
              <msup>
                <mi>{term.name}</mi>
                {term.sup ? <mn>2</mn> : <mn>{dots.length}</mn>}
              </msup>
            )}
          </For>
        </mrow>
      </math>
    </main>
  );
}
