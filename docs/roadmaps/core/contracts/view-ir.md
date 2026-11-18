---
name: view-ir
version: 1
status: draft
defined_by: spike-view-analysis
---

# Contract: view-ir

## Purpose

The output of the view analysis (`compile-view-analyze`) and the input of code generation (`compile-view-codegen`).

## Interface

To be decided by `spike-view-analysis`: template tree, holes with model path sets, event props as the AST of the message constructor call, `<For>` and `<Show>` blocks, diagnostics.

The IR does not fix how messages or markers are written into the DOM. `contracts/compiled-format.md` owns that encoding, and `compile-view-codegen` applies it.

## Behavior

- Path sets use `*` for list items.

## Stub

Hand-written IR for the counter and todo views, in this file, once the spike freezes it.

## Contract tests

`packages/idlip/test/compiler/view/`.

## Changes

- v1: initial draft.
