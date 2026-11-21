# Change request: compiled-format, refs and after-patch calls

From: `dom-refs`. Target: DOM encoding and the handler section of `contracts/compiled-format.md`.

Status: open.

## Change

- DOM encoding: an element with a `ref` carries `i-ref="<name>"`, or `i-ref="<name> <key>"` for a tuple ref in a `<For>` row (`ref={['row', t.id]}` gives `i-ref="row a1"`). The attribute comes after the events and before `i-a`. The key is the row's `<For>` key, so the attribute never patches and `i-ref` takes no binding id. The server render and the item template write it the same way.
- `Step` gains `after?: readonly After[]`, `task` becomes optional, and a step may carry `$step: true`:

```ts
interface Step {
  readonly $step?: true;
  readonly model: Model;
  readonly task?: Task;
  readonly after?: readonly After[];
}
interface After {
  readonly call: 'focus' | 'scrollIntoView' | 'reset';
  readonly args: readonly [string | readonly [string, string | number]]; // the ref name
}
```

- A handler that calls `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset` as a statement returns a step with `$step: true` and `after`. Each call is pushed to a local `$after` array where it stood. The loader collects `after` of every step of a batch and runs the calls once, in order, after the batch's patch, under `Page.root`. A name with no element warns `idlip: no ref <name>` and does nothing.
- `Dom.measure` is a built-in task site (`manifest.tasks[site] = handler=<name>`, `task$<site>(ref)` in the handler chunk). It reads the element from `document` and resolves to a plain `{ x, y, width, height }`. A missing ref warns and resolves to `null`.
- `Manifest.after?: true` is set when a handler has after calls. `runTask` calls a task with `this` set to `Page.root`.

## Why

The brief of `dom-refs` names the `i-ref` value and `Step.after`. The after calls are not tasks (no continuation), so they have their own type instead of `Task`.
