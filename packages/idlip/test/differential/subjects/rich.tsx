// One page with every kind of block next to the others: conditions with and without an else,
// a condition inside a row, a list inside a list, raw HTML, SVG and a `<Try>`.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, typescript/no-deprecated, prefer-const, no-nested-ternary
import { For, Try, trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export default function Rich(props: { title: string }): JSX.Element {
  let title = props.title;
  let open = true;
  let level = 1;
  let groups = [
    { id: 'g1', name: 'First', hot: true, tags: [{ id: 't1', label: 'x' }], note: '<i>n</i>' },
    { id: 'g2', name: 'Second', hot: false, tags: [], note: '' },
  ];
  let dots = [{ id: 'd1', r: 3 }];
  let amount = 2;

  function rename(value: string) {
    title = value;
  }
  function flip() {
    open = !open;
  }
  function more() {
    amount = amount + 1;
  }

  const big = amount > 2;

  return (
    <main class={{ open, big }} data-level={level}>
      <h1>{title}</h1>
      {open ? <p>open {title}</p> : <p>closed</p>}
      {big && <aside>big</aside>}
      {level === 1 ? <em>one</em> : level === 2 ? <strong>two</strong> : <span>many</span>}
      <button on:click={flip}>flip</button>
      <button on:click={more}>more</button>
      <button on:click={() => rename('<b>')}>rename</button>
      <input value={title} disabled={!open} />
      <ul>
        <For each={groups} key={(g) => g.id}>
          {(g) => (
            <li class={{ hot: g.hot }} title={g.name}>
              {g.hot ? <b>{g.name}</b> : g.name}
              <div html={trusted(g.note)} />
              <ol>
                <For each={g.tags} key={(t) => t.id}>
                  {(t) => <li>{t.label}</li>}
                </For>
              </ol>
              <Try catch={(error) => <u>{error}</u>}>
                <span>{check(amount)}</span>
              </Try>
            </li>
          )}
        </For>
      </ul>
      <svg viewBox="0 0 10 10">
        <For each={dots} key={(d) => d.id}>
          {(d) => <circle r={d.r} />}
        </For>
        {open && <rect width="2" height="2" />}
      </svg>
      <p>{amount} total</p>
    </main>
  );
}
