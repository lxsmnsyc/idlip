import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Form(): JSX.Element {
  let notes = '';
  let count = 0;
  let agreed = 'no';
  let renamed = '';
  const rows = [
    { id: 'a1', label: 'one' },
    { id: 'a2', label: 'two' },
  ];

  function add(text: string, n: number, ok: boolean): void {
    notes = text;
    count = n;
    agreed = ok ? 'yes' : 'no';
  }

  function rename(id: string, text: string): void {
    renamed = id + ':' + text;
  }

  return (
    <main>
      <form
        on:submit={(e) => {
          add(
            e.currentTarget.elements.draft.value,
            e.currentTarget.elements.amount.valueAsNumber,
            e.currentTarget.elements.agree.checked,
          );
        }}
      >
        <input name="draft" />
        <input name="amount" type="number" value="3" />
        <input name="agree" type="checkbox" />
        <button>Add</button>
      </form>
      <p>{notes}</p>
      <p>{count}</p>
      <p>{agreed}</p>
      <ul>
        <For each={rows} key={(r) => r.id}>
          {(r) => (
            <li>
              <form
                on:submit={(e) => {
                  rename(r.id, e.currentTarget.elements.label.value);
                }}
              >
                <input name="label" value={r.label} />
              </form>
            </li>
          )}
        </For>
      </ul>
      <p>{renamed}</p>
    </main>
  );
}
