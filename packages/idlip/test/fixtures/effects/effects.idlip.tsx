// The todo of docs/proposals/0002-modules.md with its `await`s: an id from an async function,
// a save with `try` and `catch`, and two awaits in a row with locals carried between them.
// Handlers and event arrows follow docs/proposals/0002-modules.md, which has no return types.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/promise-function-async
import type { JSX } from 'idlip/jsx-runtime';
import { loadLabel, makeId, saveTodos } from './api.ts';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

type Save = { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string };

export default function Effects(props: { step: number }): JSX.Element {
  let draft = '';
  let todos = [] satisfies Todo[] as Todo[];
  let save = { state: 'idle' } satisfies Save as Save;
  let label = '';
  let saved = 0;

  function setDraft(text: string) {
    draft = text;
  }
  async function add() {
    if (draft === '') {
      return;
    }
    const text = draft;
    const id = await makeId();
    todos = [...todos, { id, text, done: false }];
    draft = '';
  }
  async function persist() {
    save = { state: 'saving' };
    try {
      await saveTodos(todos);
      save = { state: 'idle' };
      saved = saved + props.step;
    } catch (error) {
      save = { state: 'failed', error: String(error) };
    }
    label = 'done';
  }
  async function rename(prefix: string) {
    const first = todos.length;
    const name = await loadLabel(prefix, todos.length);
    const second = await loadLabel(name, first);
    label = `${name}:${second}:${first}`;
  }

  return (
    <main>
      <input value={draft} on:input={(e) => setDraft(e.currentTarget.value)} />
      <button on:click={() => add()}>Add</button>
      <button on:click={() => persist()}>Save</button>
      <button on:click={() => rename('todo')}>Rename</button>
      <p>{label}</p>
      <p>{saved}</p>
      <p>{save.state}</p>
    </main>
  );
}
