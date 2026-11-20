---
name: view-ir
version: 5
status: draft
defined_by: spike-view-analysis
---

# Contract: view-ir

## Purpose

The output of the view analysis (`compile-view-analyze`) and the input of code generation (`compile-view-codegen`).

## Interface

To be decided by `spike-view-analysis`: template tree, holes with model path sets, event props as the AST of the message constructor call, `<For>` blocks, condition blocks, diagnostics.

Fixed now:

- The analysis reads the `view` property of the `defineModule` spec in a `*.idlip.tsx` file. Its first parameter is the model. Its second parameter is `msg`, and calls on `msg` in event props are message constructor calls.
- A hole's paths are either a list of model paths or `dynamic`. A `dynamic` hole keeps its expression as a function of the model and the loop variables.
- Partials (plain functions that return JSX) are inlined before path analysis.
- Holes, attribute values and event payloads use a closed grammar: model and loop-variable paths, literals, comparison and boolean operators, ternary, template strings and helper calls. No closures, assignments or statements. Source: `debate/debate.md`.
- A helper is an import or a module-level function, and every argument is in the closed grammar. A hole's paths are the union of its argument paths. A closure argument or a whole-model argument is an error. A helper whose body is one return expression in the closed grammar is inlined. Each helper call records `helper: 'args' | 'inlined'`.
- A ternary or `&&` whose branches are JSX is a condition block. Its condition is a hole with its own path set. `<Show>`, `<Switch>` and `<Match>` do not exist.
- Each diagnostic carries a rule id.
- Imported values and module-level `const` bindings are allowed in holes. Their path set is empty, so the hole is static.
- `ref` takes a string literal, or a tuple of a literal and a loop variable path inside `<For>`. The IR records it on the element.
- `html={trusted(...)}` is a raw HTML hole. The element must have no children.
- Elements record their namespace (HTML, SVG or MathML).
- The module's `catch` view, when present, is a second template tree with no holes that read the model.
- `<Counter.View model={m.left} />` is a child block that records the child module and its model path.

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

- v5: constants in holes, refs, raw HTML holes, namespaces, `catch` view. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v4: closed hole grammar, helper rule, JSX branches as condition blocks instead of `<Show>`, rule ids on diagnostics. Source: `debate/debate.md`, 2026-11-20.
- v3: path type reserves keyed segments. Source: `docs/proposals/0003-update-analysis.md`.
- v2: reads the `view(m, msg)` property of `defineModule`. Adds `dynamic` holes, inlined partials and child blocks. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
