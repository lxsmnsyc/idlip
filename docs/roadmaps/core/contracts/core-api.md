---
name: core-api
version: 6
status: draft
defined_by: core-api
---

# Contract: core-api

## Purpose

The public surface of `idlip`: the runtime values a component imports, the JSX types, and the package layout. A component is a plain function (`docs/proposals/0002-modules.md`), so this contract has no module API, no message types for authors and no compile-time markers. Every runtime and compiler node imports it.

## Interface

```ts
// idlip
// The one compile-time component, until the markup DSL replaces it with a block.
function For<T>(props: { each: readonly T[]; key: keyof T & string; children: (item: T) => JSX.Element }): JSX.Element;

// Raw HTML. A runtime brand, so a plain string is a type error.
type TrustedHtml = string & { readonly __trusted: unique symbol };
function trusted(html: string): TrustedHtml;

// Reserved, implemented by `dom-refs`. A ref name is a string literal or a tuple of a literal and a loop variable.
type RefName = string | readonly [string, string | number];
const Dom: {
  focus(ref: RefName): void;
  scrollIntoView(ref: RefName): void;
  measure(ref: RefName): Promise<DOMRect>;
  reset(ref: RefName): void;
};

// idlip/jsx-runtime
// on:* props take a function of the element's event. The compiler restricts it to a handler,
// or an arrow whose body is one handler call (rule ids in contracts/view-ir.md).
type EventFor<El extends Element, E extends Event> = E & { readonly currentTarget: El };
type EventProp<El extends Element, E extends Event> = (event: EventFor<El, E>) => unknown;
// Intrinsic elements: attributes, `class` as a string or a record of booleans, `ref`, `html`, `key`, on:* props.

// idlip/server, owned by `ssr-render`.
function render<Props>(component: (props: Props) => JSX.Element, props: Props, options?: { nonce?: string }): Promise<string>;
```

Internal types shared by the compiler and the runtime (`Message` as `{ t, p }`, manifest, chunk shapes) live in `packages/idlip/src/core/format.ts` and belong to `contracts/compiled-format.md`. They are not exported from `idlip`.

Subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.

## Behavior

- A module file is `*.idlip.tsx` and exports function components. The default export is the file's main component.
- Every export of `idlip` except `For` is a runtime value that does what its type says when called. The compiler recognizes `For` by import.
- `tsc` checks components as ordinary TypeScript: handler calls in event props, props of child components, the element type of `e.currentTarget`, and `For`'s `key`.
- State types follow the `let` rule of 0002: `let x = v satisfies T as T` for a wider type. The compiler reports `let x: T = v` and a bare `as T`. The type tests show why, with TS2367 on a narrowed `let`.
- A model value that does not serialize is reported at compile time when it is a function, and at server render through seroval otherwise, with the model path. `File` and `Blob` are client-only (`docs/proposals/0004-effects-refs-errors.md`, Files).
- A ref name in a `Dom` call is resolved to the element in the current DOM when the call runs.

## Stub

`packages/idlip/src/index.ts` has `Message`, `createMessage`, constructor types, `createConstructors` and `defineModule` from the design before v6. `core-api` deletes them, moves `Message` to `src/core/format.ts`, and deletes `test/messages.test.ts`.

## Contract tests

`packages/idlip/test/core/`.

## Reserved

- Subscriptions and global events: runtime functions that return a plain handle, from `docs/proposals/0004-effects-refs-errors.md`, Open questions. No names are taken until that is decided.
- Form fields from `docs/proposals/0003-update-analysis.md`, redesigned by `form-fields` for event arrows.

## Open questions

- None for this contract. Design questions live in 0002 and 0004.

## Changes

- v6: function components replace `defineModule`. Removes `defineModule`, the `Msg` types, `Handlers`, `ModelOf`, `MsgOf`, `Cmd`, `cmd`, `Sub`, `Result`, `task`, `defineSub`, `ref()` and the `event` placeholder. Event props take functions of the element's event. Adds `render` as a reserved signature. Source: `docs/proposals/0002-modules.md` and `docs/proposals/0004-effects-refs-errors.md`, revised 2026-11-21.
- v5: messages declared first as `Msg`; commands take constructors by value; `Result<T>`; `task` returns a function. Source: 0002 and 0004, 2026-11-20.
- v4: reserves `task`, `defineSub`, `ref`, `trusted`, and the `catch` and `head` module properties. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v3: reserves `event.form` and the `Dom` commands. Source: `docs/proposals/0003-update-analysis.md`.
- v2: `defineModule` with one default export replaces `defineMessages` and `defineUpdate`. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
