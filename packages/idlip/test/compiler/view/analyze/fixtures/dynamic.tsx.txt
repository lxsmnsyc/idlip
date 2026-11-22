// Holes that the analysis cannot resolve to paths: a helper takes an alias of the model, and a
// stateless component passes its whole props to a helper. Both become dynamic holes.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface Stats {
  todos: readonly Todo[];
  filter: string;
}

function summarize(stats: Stats): string {
  let left = 0;
  for (const todo of stats.todos) {
    if (!todo.done) {
      left++;
    }
  }
  return `${left} left, filter ${stats.filter}`;
}

function Badge(props: { todos: readonly Todo[]; filter: string }) {
  return <i title={summarize(props)}>{summarize(props)}</i>;
}

export default function Board(props: { initial: Todo[] }): JSX.Element {
  let todos = props.initial;
  let filter = 'all';
  let note = '';

  const stats = { todos, filter };

  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }
  function rename(id: string, text: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, text } : t));
  }
  function setFilter(value: string) {
    filter = value;
  }
  function setNote(text: string) {
    note = text;
  }

  return (
    <main>
      <p>{summarize(stats)}</p>
      <Badge todos={todos} filter={filter} />
      <p class="note">{note}</p>
      <button on:click={() => setFilter('open')}>Open</button>
      <button on:click={() => setNote('hi')}>Note</button>
      <ul>
        <For each={todos} key="id">
          {(t) => (
            <li>
              <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
              <b on:click={() => rename(t.id, `${t.text}!`)}>{t.text}</b>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
