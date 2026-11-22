// Blocks inside cloned bodies: conditions with and without an else inside a row, a condition
// that reads only props (no markers), a list inside a row with an index, a condition inside a
// nested row, a list and a condition inside a branch, and a branch inside a branch.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition, prefer-const, no-nested-ternary
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Tag {
  id: string;
  label: string;
  on: boolean;
}

interface Group {
  id: string;
  name: string;
  hot: boolean;
  tags: Tag[];
}

export default function NestedBlocks(props: { groups: Group[]; mark: boolean }): JSX.Element {
  let groups = props.groups;
  let open = true;
  let deep = false;
  let picked = '';

  function flip() {
    open = !open;
  }
  function dive() {
    deep = !deep;
  }
  function pick(id: string) {
    picked = id;
  }

  return (
    <div>
      <button on:click={flip}>flip</button>
      <button on:click={dive}>dive</button>
      <ul>
        <For each={groups} key={(group) => group.id}>
          {(group) => (
            <li class={{ hot: group.hot }}>
              {group.hot ? <b>{group.name}</b> : <i>{group.name}</i>}
              {picked === group.id && <em>picked</em>}
              {props.mark ? <u>mark</u> : null}
              <ol>
                <For each={group.tags} key={(tag) => tag.id}>
                  {(tag, index) => (
                    <li on:click={() => pick(group.id)}>
                      {index}: {tag.label}
                      {tag.on ? <span>on</span> : 'off'}
                    </li>
                  )}
                </For>
              </ol>
            </li>
          )}
        </For>
      </ul>
      {open ? (
        <section title={picked}>
          <h2>{groups.length} groups</h2>
          <p>
            <For each={groups} key={(group) => group.id}>
              {(group) => <a class={group.hot ? 'hot' : 'cold'}>{group.name}</a>}
            </For>
          </p>
          {deep ? <p>deep {picked}</p> : <p>shallow</p>}
        </section>
      ) : (
        <p>closed {picked}</p>
      )}
    </div>
  );
}
