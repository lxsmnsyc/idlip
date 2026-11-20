---
name: core-api
version: 5
status: draft
defined_by: core-api
---

# Contract: core-api

## Purpose

The public types of `idlip`: modules, messages, update handlers, commands, subscriptions and the model constraint. Every runtime and compiler node imports them. Source: `docs/proposals/0002-modules.md`.

## Interface

```ts
interface Message<Tag extends string = string, Payload = unknown> { readonly t: Tag; readonly p: Payload }
function createMessage<Tag extends string, Payload>(tag: Tag, payload: Payload): Message<Tag, Payload>;

// Msg maps each tag to its payload type. A tag with payload type undefined gives a constructor with no argument.
type MessageConstructor<Tag extends string, Payload> =
  ([Payload] extends [undefined] ? () => Message<Tag, undefined> : (payload: Payload) => Message<Tag, Payload>)
  & { readonly tag: Tag };
type MessageConstructors<Msg> = { readonly [Tag in keyof Msg & string]: MessageConstructor<Tag, Msg[Tag]> };
type MessageOf<Msg> = /* union of Message<Tag, Msg[Tag]> over the tags */;

// Exactly one handler per tag. Payload types come from Msg, so handlers need no annotations.
type Handlers<Model, Msg> = {
  readonly [Tag in keyof Msg]: (model: Model, payload: Msg[Tag], msg: MessageConstructors<Msg>) => Model | readonly [Model, Cmd];
};

interface ModuleSpec<Model, Msg, Props = undefined> {
  readonly init: (props: Props) => Model;
  readonly update: Handlers<Model, Msg>;
  readonly view: (model: Model, msg: MessageConstructors<Msg>, props: Props) => JSX.Element;
  readonly subscriptions?: (model: Model, msg: MessageConstructors<Msg>, props: Props) => ReadonlyArray<Sub | false | null | undefined>;
  // Reserved: child module table, implemented by nesting.
  readonly children?: Record<string, unknown>;
  // Reserved: error boundary fallback, and document head for the root module only.
  readonly catch?: (error: unknown) => JSX.Element;
  readonly head?: (model: Model) => { title?: string; meta?: ReadonlyArray<Record<string, string>> };
}
interface Module<Model, Msg, Props = undefined> extends ModuleSpec<Model, Msg, Props> {
  // The component that renders this module inside a parent view: <Counter.View model={m.left} />.
  readonly View: (props: { model: Model } & Props) => JSX.Element;
}
function defineModule<Model, Msg, Props = undefined>(): (spec: ModuleSpec<Model, Msg, Props>) => Module<Model, Msg, Props>;

type ModelOf<M> = /* Model of a Module */;
type MsgOf<M> = /* MessageOf of a Module's Msg */;

// `to` is the tag of the constructor that receives the result.
interface Cmd { readonly kind: string; readonly args: Serializable; readonly to?: string }
type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const cmd: { readonly none: Cmd; batch(cmds: readonly Cmd[]): Cmd; send(message: Message): Cmd };
interface Sub { readonly kind: string; readonly args: Serializable; readonly message: Message }

// Reserved, implemented by later nodes (`docs/proposals/0004-effects-refs-errors.md`).
type Task<Input, Output> = ((input: Input, to: MessageConstructor<string, Result<Output>>) => Cmd) & { readonly id: string };
function task<Input, Output>(fn: (input: Input, signal: AbortSignal) => Promise<Output>, options?: { mode?: 'all' | 'latest' | 'queue' }): Task<Input, Output>;
function defineSub<Args, State, Value>(spec: { start(args: Args, send: (value: Value) => void): State; update?(state: State, args: Args): void; stop(state: State): void }): { readonly id: string; listen(args: Args, to: MessageConstructor<string, Value>): Sub };
type RefName = string | readonly [string, string | number];
interface Ref { readonly ref: RefName }
function ref(name: RefName): Ref;
type TrustedHtml = string & { readonly __trusted: unique symbol };
function trusted(html: string): TrustedHtml;

// Placeholder read from the DOM event when the message is dispatched.
const event: { readonly value: string; readonly checked: boolean; readonly key: string };

type Serializable = /* JSON values plus Date, Map, Set, bigint, rejecting functions at type level */;
```

Subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.

## Behavior

- A module file is `*.idlip.tsx` and has one default export, the result of `defineModule`.
- `update` has exactly the tags of `Msg`. A missing or extra handler is a type error. Property order in the spec does not matter.
- Tags are camelCase. A tag with payload type `undefined` has a constructor with no argument.
- `msg.toggle.tag` is `'toggle'`. Calling a constructor returns plain data.
- A command that returns a result takes the receiving constructor by value, for example `Http.get(url, msg.gotTodos)`. Its payload type must be `Result<T>` for the command's `T`, checked at type level. `Cmd.to` stores the constructor's tag.
- `cmd.send(message)` dispatches a message the module got as a prop. The message keeps the path of the module that made it.
- `Sub.message` is the message dispatched on each event. It is built with the `msg` parameter, so its payload is type-checked.
- `Serializable` rejects functions at type level. Class instances other than Date, Map and Set cannot be told apart by a structural type, so `ssr-render` rejects them at render time through seroval and reports the model path.
- Falsy entries returned by `subscriptions` are ignored.
- `task()` and `defineSub()` must be called at module level. The compiler rejects a call inside a function. Their ids come from the compiler.
- A `Ref` in command, task or subscription args is resolved to its `Element` by the runtime before the effect runs.

## Stub

`packages/idlip/src/index.ts` has `Message`, `createMessage`, `MessageConstructor`, `MessageConstructors`, `MessageOf`, `createConstructors` and `defineModule`, typed from inferred handlers (the design before v5). `core-api` retypes them from a declared `Msg`, adds `View` and the rest.

## Contract tests

`packages/idlip/test/core/`.

## Reserved

From `docs/proposals/0003-update-analysis.md`. Not exported until their nodes land, but the names are taken:

- `event.form.<name>: string` and `event.form.all.<name>: string[]`, implemented by `form-fields`.
- `Dom.reset(target)` and `Dom.focus(target)` commands, implemented by `form-fields`. The target type is an open question in 0003.

## Open questions

- None.

## Changes

- v5: messages are declared first as `Msg`, and handlers take their payload types from it. Handlers receive `msg`. Commands take the receiving constructor by value; `Result<T>` added; `task` returns a function instead of an object with `run`. Adds the reserved `children` table. Removes the property order rule and `PayloadOf`. Source: `docs/proposals/0002-modules.md` (revised) and `docs/proposals/0004-effects-refs-errors.md`, 2026-11-20.
- v4: reserves `task`, `defineSub`, `ref`, `trusted`, and the `catch` and `head` module properties. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v3: reserves `event.form` and the `Dom` commands. Source: `docs/proposals/0003-update-analysis.md`.
- v2: `defineModule` with one default export replaces `defineMessages` and `defineUpdate`. Message types come from the handlers. Constructors carry `tag`. `Sub` carries a message instead of a tag. Adds `cmd.send`, `event`, `ModelOf` and `MsgOf`. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
