---
name: core-api
version: 1
status: draft
defined_by: core-api
---

# Contract: core-api

## Purpose

The public types of `idlip`: messages, update handlers, commands, subscriptions and the model constraint. Every runtime and compiler node imports them.

## Interface

```ts
interface Message<Tag extends string = string, Payload = unknown> { readonly t: Tag; readonly p: Payload }
function createMessage<Tag extends string, Payload>(tag: Tag, payload: Payload): Message<Tag, Payload>;
function defineMessages<Spec>(): MessageConstructors<Spec>;
type MessageOf<Spec> = /* union of Message<Tag, Payload> over the tags of Spec */;

// Constructors is the object returned by defineMessages, as in defineUpdate<Model, typeof msg>.
type SpecOf<Constructors> = /* recovers Spec from MessageConstructors<Spec> */;
type Handler<Model, Payload> = (model: Model, payload: Payload) => Model | readonly [Model, Cmd];
type Handlers<Model, Constructors> = { readonly [Tag in keyof SpecOf<Constructors>]: Handler<Model, Payload> };
interface Update<Model, Constructors> { readonly handlers: Handlers<Model, Constructors> }
function defineUpdate<Model, Constructors>(handlers: Handlers<Model, Constructors>): Update<Model, Constructors>;

interface Cmd { readonly kind: string; readonly args: Serializable; readonly to?: string }
const cmd: { readonly none: Cmd; batch(cmds: readonly Cmd[]): Cmd };
interface Sub { readonly kind: string; readonly args: Serializable; readonly to: string }
type Subscriptions<Model> = (model: Model) => ReadonlyArray<Sub | false | null | undefined>;

type Serializable = /* JSON values plus Date, Map, Set, bigint, rejecting functions at type level */;
```

Subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.

## Behavior

- Tags are camelCase. A tag with no payload has payload type `undefined`.
- `to` names the message tag that receives a command's result.
- `Serializable` rejects functions at type level. Class instances other than Date, Map and Set cannot be told apart by a structural type, so `ssr-render` rejects them at render time through seroval and reports the model path.
- Falsy entries returned by `subscriptions` are ignored.

## Stub

`defineMessages` and `createMessage` exist in `packages/idlip/src/index.ts`.

## Contract tests

`packages/idlip/test/core/`.

## Changes

- v1: initial draft.
