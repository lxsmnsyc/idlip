import { trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

// This file is checked by tsc and never runs. The cases below are the type tests.

declare function add(): unknown;
declare function setDraft(value: string): unknown;
declare function toggle(id: number): unknown;
declare function onKey(): unknown;

export function Ok(): JSX.Element {
  return (
    <main class={{ done: true }} data-x="1" aria-label="x">
      <input
        on:input={(e) => setDraft(e.currentTarget.value)}
        on:click={(e) => toggle(e.currentTarget.checked ? 1 : 0)}
      />
      <button on:click={add} latest:pointermove={add}>
        add
      </button>
      <div html={trusted('<b>')} ref="box" key="a" />
      <window latest:pointermove={onKey} on:keydown={(e) => toggle(e.key.length)} />
      <document on:visibilitychange={onKey} />
    </main>
  );
}

export function Bad(): JSX.Element {
  return (
    <main>
      {/* @ts-expect-error checked is on input, not button */}
      <button on:click={(e) => toggle(e.currentTarget.checked ? 1 : 0)} />
      {/* @ts-expect-error a plain string is not TrustedHtml */}
      <div html="<b>" />
      {/* @ts-expect-error a handler is not a value */}
      <button on:click={1} />
      {/* @ts-expect-error window takes no attributes */}
      <window class="x" />
      {/* @ts-expect-error document takes no attributes */}
      <document id="x" />
      {/* @ts-expect-error latest props keep the element type */}
      <button latest:click={(e) => toggle(e.currentTarget.checked ? 1 : 0)} />
    </main>
  );
}
