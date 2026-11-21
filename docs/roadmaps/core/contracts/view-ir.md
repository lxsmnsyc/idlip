---
name: view-ir
version: 6
status: draft
defined_by: spike-view-analysis
---

# Contract: view-ir

## Purpose

The output of the component analysis (`compile-view-analyze`) and the input of code generation (`compile-view-codegen`) and of handler compilation (`compile-update`).

## Interface

To be decided by `spike-view-analysis`: template tree, holes with model path sets, event props as the handler name and the argument expressions, `<For>` blocks, condition blocks, diagnostics.

Fixed now:

- The analysis reads each function component in a `*.idlip.tsx` file (`docs/proposals/0002-modules.md`). The IR lists the component's state fields (`let`, with initial expressions), derived values (`const`), handlers (name, parameters, free variables, `await` segments) and the view template from `return`. Model paths start at a state field name, for example `todos.*.done`.
- An event prop is a handler reference, or an arrow whose body is one handler call. The IR records the handler name and its argument expressions. Property paths on the event parameter are recorded as event paths, read at dispatch.
- A hole's paths are either a list of model paths or `dynamic`. A `dynamic` hole keeps its expression as a function of the model and the loop variables.
- Components with no state and no handlers are inlined before path analysis.
- Derived values are inlined into the holes that read them.
- Holes, attribute values and event payloads use a closed grammar: state, derived value, prop and loop-variable paths, literals, comparison and boolean operators, ternary, template strings and helper calls. No closures, assignments or statements. Source: `debate/debate.md`.
- A helper is an import or a module-level function, and every argument is in the closed grammar. A hole's paths are the union of its argument paths. A closure argument or a whole-model argument is an error. A helper whose body is one return expression in the closed grammar is inlined. Each helper call records `helper: 'args' | 'inlined'`.
- A ternary or `&&` whose branches are JSX is a condition block. Its condition is a hole with its own path set. `<Show>`, `<Switch>` and `<Match>` do not exist.
- Each diagnostic carries a rule id.
- Imported values and module-level `const` bindings are allowed in holes. Their path set is empty, so the hole is static.
- `ref` takes a string literal, or a tuple of a literal and a loop variable path inside `<For>`. The IR records it on the element.
- `html={trusted(...)}` is a raw HTML hole. The element must have no children.
- Elements record their namespace (HTML, SVG or MathML).
- `<Counter start={0} />` for a stateful component is a child block that records the child component, its props and its slot (explicit `key`, `<For>` key or position).

The IR does not fix how messages or markers are written into the DOM. `contracts/compiled-format.md` owns that encoding, and `compile-view-codegen` applies it.

## Behavior

- Path sets use `*` for list items.
- The path type must leave room for keyed segments (`todos[id=selected].text`), from `docs/proposals/0003-update-analysis.md`. The analysis emits them only once `keyed-paths` lands.
- Until `dynamic-paths` lands, the analysis reports a `dynamic` hole as an error diagnostic and emits no code for it.

## Stub

Hand-written IR for the counter and todo views, in this file, once the spike freezes it.

## Contract tests

`packages/idlip/test/compiler/view/`.

## Changes

- v6: reads function components instead of `defineModule`: state fields, derived values, handlers and the view. Event props are handler references or arrows with one handler call. Stateless components are inlined. The `catch` view is removed. Source: `docs/proposals/0002-modules.md`, revised 2026-11-21.
- v5: constants in holes, refs, raw HTML holes, namespaces, `catch` view. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v4: closed hole grammar, helper rule, JSX branches as condition blocks instead of `<Show>`, rule ids on diagnostics. Source: `debate/debate.md`, 2026-11-20.
- v3: path type reserves keyed segments. Source: `docs/proposals/0003-update-analysis.md`.
- v2: reads the `view(m, msg)` property of `defineModule`. Adds `dynamic` holes, inlined partials and child blocks. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
