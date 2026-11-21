# Change request: view-ir dynamic holes

- From node: dynamic-paths
- Status: proposed

## Problem

view-ir says the analysis never produces `dynamic` and that a `dynamic` hole is the error `hole-dynamic`. Both statements change.

## Proposed change

1. A hole gets `paths: 'dynamic'` when all hold:
   - it is a text hole or an attribute value;
   - some call in it has `helper: 'args'`, a `module` or `import` callee, and an `object` argument;
   - it reads no `loop`, `local` or `event` root and calls no impure global.
2. The `object` argument comes from two sources: an alias of the model (`const view = { todos, filter }` passed to a helper), and the whole `props` of an inlined stateless component (`summarize(props)`, an object of the caller's values). The second source was `props-whole`. `props-whole` stays for a computed key on `props` (`props[props.k]`).
3. `Hole.expr` keeps the lowered expression. Only `paths` changes. Holes that are not dynamic keep their exact paths, so existing output does not change.
4. `Hole.fallback?: Path[]` keeps the coarse static paths of a dynamic hole. Code generation uses them to bind the hole as a static hole inside `<For>`, conditions, `<Try>` and child components, where templates record no reads. Output there equals the base. `hole-dynamic` is no longer reported.

## Affected nodes

`document-head`, `svg-and-html` (both edit `plan.ts`), `nesting-compile` (a child module binds a dynamic hole statically).

## Workaround in place

`isTracked` and `scanTracked` in `analyze.ts`, `bindDynamic` in `plan.ts`. The analyzer test lists `dynamic.idlip.tsx.txt` as the only fixture with a dynamic hole.

## Decision
