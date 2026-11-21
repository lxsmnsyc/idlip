/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// The todo example of docs/proposals/0002-modules.md. The prototype plugin
// never runs this file: it reads the source and emits chunks from it.
import { For, Random } from 'idlip';
import { saveTodos } from './api';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}
type Save = { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string };

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) left++;
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }) {
  let draft = '';
  let todos = props.initial;
  let save = { state: 'idle' } satisfies Save as Save;

  const left = countLeft(todos);

  function setDraft(text: string) {
    draft = text;
  }
  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }
  async function add() {
    if (draft === '') return;
    const id = await Random.id();
    todos = [...todos, { id, text: draft, done: false }];
    draft = '';
  }
  async function persist() {
    save = { state: 'saving' };
    try {
      await saveTodos(todos);
      save = { state: 'idle' };
    } catch (error) {
      save = { state: 'failed', error: String(error) };
    }
  }

  return (
    <main>
      <input value={draft} on:input={(e) => setDraft(e.currentTarget.value)} />
      <button on:click={add} disabled={draft === ''}>
        Add
      </button>
      <button on:click={persist} disabled={save.state === 'saving'}>
        Save
      </button>
      <p>{left} left</p>
      <For each={todos} key="id">
        {(t) => (
          <li class={{ done: t.done }}>
            <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
            {t.text}
          </li>
        )}
      </For>
    </main>
  );
}
