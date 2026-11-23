// The rows page of the benchmark: the table of js-framework-benchmark, keyed by row ID.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import { build, remove, swap, update } from '../../../harness/rows.mjs';
import type { Row } from '../../../harness/rows.mjs';

export default function App(props: { initial: Row[] }): JSX.Element {
  let rows = props.initial;
  let selected = 0;
  let next = props.initial.length + 1;

  function create(count: number) {
    rows = build(next, count);
    next = next + count;
  }
  function append() {
    rows = [...rows, ...build(next, 1000)];
    next = next + 1000;
  }
  function updateRows() {
    rows = update(rows);
  }
  function clear() {
    rows = [];
  }
  function swapRows() {
    rows = swap(rows);
  }
  function select(id: number) {
    selected = id;
  }
  function removeRow(id: number) {
    rows = remove(rows, id);
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>bench</title>
        {/* The same stylesheet in every app, so that selecting a row paints it. */}
        <style>
          table&#123;border-collapse:collapse&#125;td&#123;padding:4px 8px;border-top:1px solid
          #ddd&#125;tr.danger&#123;background:#f2dede&#125;
        </style>
      </head>
      <body>
        <div>
          <div class="jumbotron">
            <h1>idlip</h1>
            <button id="run" on:click={() => create(1000)}>
              Create 1,000 rows
            </button>
            <button id="runlots" on:click={() => create(10000)}>
              Create 10,000 rows
            </button>
            <button id="add" on:click={() => append()}>
              Append 1,000 rows
            </button>
            <button id="update" on:click={() => updateRows()}>
              Update every 10th row
            </button>
            <button id="clear" on:click={() => clear()}>
              Clear
            </button>
            <button id="swaprows" on:click={() => swapRows()}>
              Swap rows
            </button>
          </div>
          <table class="table">
            <tbody>
              <For each={rows} key={(row) => row.id}>
                {(row) => (
                  <tr class={selected === row.id ? 'danger' : ''}>
                    <td class="col-md-1">{row.id}</td>
                    <td class="col-md-4">
                      <a class="lbl" on:click={() => select(row.id)}>
                        {row.label}
                      </a>
                    </td>
                    <td class="col-md-1">
                      <a class="remove" on:click={() => removeRow(row.id)}>
                        x
                      </a>
                    </td>
                    <td class="col-md-6"></td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
}
