// A page with refs, Dom calls after the patch and `await Dom.measure`.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/promise-function-async
import { Dom, For, Random } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Refs(props: { start: string }): JSX.Element {
  let items = [{ id: 'a1', text: props.start }];
  let size = '';

  function focusSearch() {
    Dom.focus('search');
  }
  function addAndFocus() {
    items = [...items, { id: 'a2', text: 'two' }];
    Dom.focus(['row', 'a2']);
  }
  function missing() {
    Dom.focus('nope');
  }
  function clear() {
    Dom.reset('form');
  }
  async function measure() {
    const box = await Dom.measure('search');
    size = box === null ? '' : box.width + 'x' + box.height;
  }
  async function measureMissing() {
    const box = await Dom.measure('nope');
    size = box === null ? 'none' : 'some';
  }
  async function add() {
    const id = await Random.id();
    items = [...items, { id, text: 'new' }];
  }

  return (
    <main>
      <form ref="form">
        <input ref="search" value="x" />
      </form>
      <button on:click={() => focusSearch()}>focus</button>
      <button on:click={() => addAndFocus()}>add and focus</button>
      <button on:click={() => missing()}>missing</button>
      <button on:click={() => clear()}>clear</button>
      <button on:click={() => measure()}>measure</button>
      <button on:click={() => measureMissing()}>measure missing</button>
      <button on:click={() => add()}>add</button>
      <p>{size}</p>
      <ul>
        <For each={items} key="id">
          {(r) => <li ref={['row', r.id]}>{r.text}</li>}
        </For>
      </ul>
    </main>
  );
}
