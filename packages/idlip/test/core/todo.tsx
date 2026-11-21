/** @jsxImportSource ./jsx */
// The todo component of docs/proposals/0002-modules.md, Example, checked by `tsc` only.
// The tests import types from this file and never run it.
// This file copies the example from the proposal and holds deliberate type errors.
/* oxlint-disable */
import { For } from '../../src/core/index.ts';
import type { JSX } from './jsx/jsx-runtime.ts';

// `Random` joins `idlip` in `commands-subs`. This stand-in has its signature.
declare const Random: { id(): Promise<string> };

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}
export type Save = { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string };

declare function saveTodos(todos: readonly Todo[]): Promise<void>;

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) left++;
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }): JSX.Element {
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

export function Cases(): JSX.Element {
  function toggle(id: string) {
    void id;
  }
  const todos: Todo[] = [];
  return (
    <main>
      {/* @ts-expect-error toggle takes a string id */}
      <input type="checkbox" on:click={() => toggle(1)} />
      {/* @ts-expect-error the prop `initial` is missing */}
      <TodoApp />
      {/* @ts-expect-error `nope` is not a field of Todo */}
      <For each={todos} key="nope">
        {(t) => <li>{t.text}</li>}
      </For>
      {/* @ts-expect-error currentTarget is a button, which has no `checked` */}
      <button on:click={(e) => e.currentTarget.checked}>x</button>
    </main>
  );
}

export function Narrowing(): void {
  // A `let` with an annotation narrows to its initial value in the same scope.
  let save: Save = { state: 'idle' };
  // @ts-expect-error TS2367: save is narrowed to `{ state: 'idle' }`
  void (save.state === 'saving');
  save = { state: 'saving' };

  // `satisfies Save as Save` keeps the wider type.
  let wide = { state: 'idle' } satisfies Save as Save;
  void (wide.state === 'saving');
  wide = { state: 'saving' };

  // @ts-expect-error a wrong initial value fails `satisfies`
  let bad = { state: 'nope' } satisfies Save as Save;
  void bad;
}
