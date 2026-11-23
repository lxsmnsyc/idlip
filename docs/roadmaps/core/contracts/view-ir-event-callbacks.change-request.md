# Change request: view-ir, event callbacks

From: `event-callbacks`. Target: Events in `contracts/view-ir.md`.

Status: proposed. Implemented on `node/event-callbacks`.

## Problem

`Event` held one call: `target` and `args`, with `paths` read at render. It could not branch, call two handlers, or read a row at event time.

## Proposed change

`Event` is `{ name, mode, body, modifiers, span }`.

```ts
type EventStep =
  | { kind: 'send'; target: Target; args: Expr[]; span: Span }
  | { kind: 'if'; test: Expr; then: EventStep[]; else: EventStep[] };

type EventBody =
  | { kind: 'steps'; steps: EventStep[] }
  | { kind: 'message'; target: Target; args: Expr[]; paths: Path[] };

type EventModifier =
  | { kind: 'prevent'; keys?: string[] } // keys: prevent only these key filters
  | { kind: 'stop' } | { kind: 'once' } | { kind: 'capture' } | { kind: 'passive' }
  | { kind: 'key'; filter: string };
```

- `steps` is an event arrow, a bare handler, a global event and a `<Subscribe>` event. Every `send` has a handler target. Its expressions may read the event (`root.kind === 'event'`, any property path, computed segments included), state, props, loop variables and `const` locals, which are inlined.
- `message` is data built at render: a message prop of a stateful child (`target` handler, `args` and `paths` read at render), a forwarded message prop (`target` prop) and `reset`. `args` cannot read the event.
- `paths` of a `steps` event is gone: nothing patches. A model path that a step reads is read when the event runs.
- A `prevent` modifier with `keys` comes from `if (<key test>) e.preventDefault();` at the start of the arrow. `keys` has one filter per `||` alternative.
- The rule `event-computed-key` is removed. `event-placeholder` is a whole event passed as an argument. New rules: `event-statement`, `event-no-call`, `event-prevent-twice`, `event-message-body`, `event-message-event`, `event-target-nested`.

## Why

The brief of `event-callbacks`: an arrow compiles to a function that computes its messages from the event, the model and the row scope.

## Affected nodes

`compile-view-codegen`, `compile-update`, `devtools`.

## Workaround in place

Implemented in `src/compiler/view/analyze/{ir,analyze,print}.ts`.

## Decision
