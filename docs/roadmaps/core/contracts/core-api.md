---
name: core-api
version: 3
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

// A handler with no payload parameter gives a constructor with no argument.
type Handler<Model> = (model: Model, payload: any) => Model | readonly [Model, Cmd];
type PayloadOf<H> = /* second parameter of H, or undefined when H has one parameter */;
type MessageConstructor<Tag extends string, Payload> =
  ([Payload] extends [undefined] ? () => Message<Tag, undefined> : (payload: Payload) => Message<Tag, Payload>)
  & { readonly tag: Tag };
type MessageConstructors<Handlers> = { readonly [Tag in keyof Handlers & string]: MessageConstructor<Tag, PayloadOf<Handlers[Tag]>> };
type MessageOf<Handlers> = /* union of Message<Tag, PayloadOf<Handlers[Tag]>> over the tags */;

interface ModuleSpec<Model, Handlers, Props = undefined> {
  readonly init: (props: Props) => Model;
  readonly update: Handlers;
  readonly view: (model: Model, msg: MessageConstructors<Handlers>, props: Props) => JSX.Element;
  readonly subscriptions?: (model: Model, msg: MessageConstructors<Handlers>, props: Props) => ReadonlyArray<Sub | false | null | undefined>;
}
interface Module<Model, Handlers, Props = undefined> extends ModuleSpec<Model, Handlers, Props> {
  // The component that renders this module inside a parent view: <Counter.View model={m.left} />.
  readonly View: (props: { model: Model } & Props) => JSX.Element;
}
function defineModule<Model, Props = undefined>(): <Handlers extends Record<string, Handler<Model>>>(
  spec: ModuleSpec<Model, Handlers, Props>,
) => Module<Model, Handlers, Props>;

type ModelOf<M> = /* Model of a Module */;
type MsgOf<M> = /* MessageOf of a Module's Handlers */;

interface Cmd { readonly kind: string; readonly args: Serializable; readonly to?: string }
const cmd: { readonly none: Cmd; batch(cmds: readonly Cmd[]): Cmd; send(message: Message): Cmd };
interface Sub { readonly kind: string; readonly args: Serializable; readonly message: Message }

// Placeholder read from the DOM event when the message is dispatched.
const event: { readonly value: string; readonly checked: boolean; readonly key: string };

type Serializable = /* JSON values plus Date, Map, Set, bigint, rejecting functions at type level */;
```

Subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.

## Behavior

- A module file is `*.idlip.tsx` and has one default export, the result of `defineModule`.
- `update` comes before `view` and `subscriptions` in the spec. TypeScript infers properties in order. The compiler reports the wrong order.
- Tags are camelCase. A handler with only the model parameter has payload type `undefined`.
- `msg.toggle.tag` is `'toggle'`. Calling a constructor returns plain data.
- `Cmd.to` is a string tag. The compiler reports a `to` that is not an `update` key of the module.
- `cmd.send(message)` dispatches a message the module got as a prop. The message keeps the path of the module that made it.
- `Sub.message` is the message dispatched on each event. It is built with the `msg` parameter, so its payload is type-checked.
- `Serializable` rejects functions at type level. Class instances other than Date, Map and Set cannot be told apart by a structural type, so `ssr-render` rejects them at render time through seroval and reports the model path.
- Falsy entries returned by `subscriptions` are ignored.

## Stub

`packages/idlip/src/index.ts` has `Message`, `createMessage`, `MessageConstructor`, `MessageConstructors`, `MessageOf`, `createConstructors` and `defineModule`. `defineModule` returns its spec without `View`. `core-api` adds the rest.

## Contract tests

`packages/idlip/test/core/`.

## Reserved

From `docs/proposals/0003-update-analysis.md`. Not exported until their nodes land, but the names are taken:

- `event.form.<name>: string` and `event.form.all.<name>: string[]`, implemented by `form-fields`.
- `Dom.reset(target)` and `Dom.focus(target)` commands, implemented by `form-fields`. The target type is an open question in 0003.

## Open questions

- Whether `Cmd.to` can be checked against the payload type at type level. A `msg` parameter on handlers fails, because its type depends on the handlers.

## Changes

- v3: reserves `event.form` and the `Dom` commands. Source: `docs/proposals/0003-update-analysis.md`.
- v2: `defineModule` with one default export replaces `defineMessages` and `defineUpdate`. Message types come from the handlers. Constructors carry `tag`. `Sub` carries a message instead of a tag. Adds `cmd.send`, `event`, `ModelOf` and `MsgOf`. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
