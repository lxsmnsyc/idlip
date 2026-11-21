# Change request: core-api v8 to v9

- From node: compiled-format
- Status: open

## Problem

1. compiled-format v8 keeps events that fire before the loader runs with a small inline listener script in `<head>`. It is not part of `render()` output, so the fixture HTML does not depend on runtime code, and the host page must place it with the request's CSP nonce. core-api v8 gives `idlip/server` only `render`, so a host has no public way to get the script.
2. core-api v8 says the compiler restricts an event prop to "a handler, or an arrow whose body is one handler call". `contracts/view-ir-v9.change-request.md` adds block-bodied arrows for `prevent`, `stop` and key filters, which that line forbids.

## Proposed change

1. Add to the `idlip/server` part of the Interface:

   ```ts
   // idlip/server, implemented by `resume-loader`.
   // Returns the listener `<script>` tag for the page's `<head>`. It keeps events that fire before the loader runs.
   function renderListener(options?: { nonce?: string }): string;
   ```

   And to Behavior: "A page puts `renderListener()` in `<head>`, before any markup from `render()`."

2. Replace the comment above `EventFor` in the `idlip/jsx-runtime` part:

   ```ts
   // on:* props take a function of the element's event. The compiler restricts it to a handler,
   // an arrow whose body is one handler call, or an arrow whose block body is leading
   // `e.preventDefault()` and `e.stopPropagation()` statements and one handler call, optionally
   // inside a key test `if (e.key === '<key>')` (rule ids and forms in contracts/view-ir.md).
   ```

## Affected nodes

`resume-loader` (implements `renderListener`), `ssr-render` (exports it next to `render`), `vite-plugin` and `example-todo` (put it in the page), `e2e-harness` (its fixture page shell), `compile-view-analyze` (accepts the block-bodied arrow once view-ir v9 lands).

## Workaround in place

None needed yet. No node renders a full page before `resume-loader` and `e2e-harness`. `jsx-types` already types the block-bodied arrow, since `EventProp` returns `unknown`.

## Decision
