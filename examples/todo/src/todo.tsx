// The todo of docs/proposals/0002-modules.md without `await`: ids come from `next`,
// and `persist` is left out until `custom-effects`.
// Handlers and event arrows follow docs/proposals/0002-modules.md, which has no return types.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }): JSX.Element {
  let draft = '';
  let todos = props.initial;
  let next = props.initial.length + 1;

  const left = countLeft(todos);

  function setDraft(text: string) {
    draft = text;
  }
  function clear() {
    draft = '';
  }
  function add() {
    if (draft === '') {
      return;
    }
    todos = [...todos, { id: `t${next}`, text: draft, done: false }];
    next = next + 1;
    draft = '';
  }
  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  return (
    <main>
      <form
        on:submit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          on:input={(e) => setDraft(e.currentTarget.value)}
          on:keydown={(e) => {
            if (e.key === 'Escape') {
              clear();
            }
          }}
        />
        <button disabled={draft === ''}>Add</button>
      </form>
      <p>{left} left</p>
      <ul>
        <For each={todos} key={(t) => t.id}>
          {(t) => (
            <li class={{ done: t.done }}>
              <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
              {t.text}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
