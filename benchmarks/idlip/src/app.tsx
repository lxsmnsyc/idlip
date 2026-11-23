// The todos page of the benchmark: a todo list and a counter in one module.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Todo {
  id: string;
  title: string;
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

export default function App(props: { initial: Todo[] }): JSX.Element {
  let todos = props.initial;
  let draft = '';
  let next = props.initial.length + 1;
  let count = 0;

  const left = countLeft(todos);
  const double = count * 2;

  function setDraft(text: string) {
    draft = text;
  }
  function add() {
    if (draft.trim() === '') {
      return;
    }
    todos = [...todos, { id: String(next), title: draft, done: false }];
    next = next + 1;
    draft = '';
  }
  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }
  function increment() {
    count = count + 1;
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>bench</title>
      </head>
      <body>
        <main>
          <h1>Todos</h1>
          <form
            on:submit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              value={draft}
              placeholder="What needs doing?"
              on:input={(e) => setDraft(e.currentTarget.value)}
            />
            <button>Add</button>
          </form>
          <ul>
            <For each={todos} key={(t) => t.id}>
              {(t) => (
                <li class={{ done: t.done }}>
                  <button class="todo" on:click={() => toggle(t.id)}>
                    {t.title}
                  </button>
                </li>
              )}
            </For>
          </ul>
          <p>{left} left</p>
          <h2>Counter</h2>
          <button on:click={() => increment()}>Clicked {count} times</button>
          <p>Double: {double}</p>
        </main>
      </body>
    </html>
  );
}
