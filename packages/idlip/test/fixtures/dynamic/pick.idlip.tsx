// A dynamic hole whose reads depend on the state: `pick` reads `a` or `b` by `mode`. After
// `mode` changes, the hole's recorded paths change with it.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import type { JSX } from 'idlip/jsx-runtime';

interface View {
  mode: string;
  a: string;
  b: string;
}

function pick(view: View): string {
  return view.mode === 'a' ? view.a : view.b;
}

export default function Pick(): JSX.Element {
  let mode = 'a';
  let a = 'first';
  let b = 'second';

  const view = { mode, a, b };

  function setMode(value: string) {
    mode = value;
  }
  function setA(value: string) {
    a = value;
  }
  function setB(value: string) {
    b = value;
  }

  return (
    <main>
      <p class="out">{pick(view)}</p>
      <button on:click={() => setMode('b')}>Mode b</button>
      <button on:click={() => setA('first!')}>A</button>
      <button on:click={() => setB('second!')}>B</button>
    </main>
  );
}
