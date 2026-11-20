---
name: view-ir
version: 3
status: draft
defined_by: spike-view-analysis
---

# Contract: view-ir

## Purpose

The output of the view analysis (`compile-view-analyze`) and the input of code generation (`compile-view-codegen`).

## Interface

To be decided by `spike-view-analysis`: template tree, holes with model path sets, event props as the AST of the message constructor call, `<For>` and `<Show>` blocks, diagnostics.

Fixed now:

- The analysis reads the `view` property of the `defineModule` spec in a `*.idlip.tsx` file. Its first parameter is the model. Its second parameter is `msg`, and calls on `msg` in event props are message constructor calls.
- A hole's paths are either a list of model paths or `dynamic`. A `dynamic` hole keeps its expression as a function of the model and the loop variables.
- Partials (plain functions that return JSX) are inlined before path analysis.
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

- v3: path type reserves keyed segments. Source: `docs/proposals/0003-update-analysis.md`.
- v2: reads the `view(m, msg)` property of `defineModule`. Adds `dynamic` holes, inlined partials and child blocks. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
