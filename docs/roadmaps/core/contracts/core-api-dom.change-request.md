# Change request: core-api, Dom

From: `dom-refs`. Target: the `Dom` block of `contracts/core-api.md`.

Status: open.

## Change

`Dom` is exported from `idlip`, with `RefName` and `Rect`. `measure` returns a plain rect, because a `DOMRect` does not serialize into the message log.

```ts
// idlip
type RefName = string | readonly [string, string | number];
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
const Dom: {
  focus(ref: RefName): void;
  scrollIntoView(ref: RefName): void;
  measure(ref: RefName): Promise<Rect | null>; // null, with a warning, when no element has the ref
  reset(ref: RefName): void;
};
```

- In a compiled handler, `focus`, `scrollIntoView` and `reset` must be statements of their own (rule `dom-call-position`). They run once after the batch's patch.
- Called outside a handler, they act on `document` at once. `reset` resets a form, or sets a field back to its default value.

## Why

The decision of the one-shot run: plain `Dom.focus()` calls are deferred until after the patch, and `measure` returns a plain rect.
