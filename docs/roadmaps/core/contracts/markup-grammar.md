---
name: markup-grammar
version: 1
status: draft
defined_by: markup-syntax
---

# Contract: markup-grammar

## Purpose

The grammar of `.idlip` files. Used by `markup-parser`, `markup-lower`, `markup-compile` and `markup-language-core`.

## Interface

To be written by `markup-syntax` in `docs/proposals/0005-markup.md`. Outline: a `.idlip` file is a plain TS module. Markup is only the final `return` of a capitalized function. Blocks: `#if`, `#else if`, `#else`, `#for (t, i of todos by t.id)`, `#switch`, `#case`, `#default`, `#try`, `#catch (error, reset)`, `#head`. Lowercase built-ins: `<subscribe>`, `<window>`, `<document>`.

## Behavior

- Every block lowers to the TSX the existing analyzer accepts.
- Block components are never imported.

## Stub

Paired fixtures in `packages/idlip/test/compiler/markup/fixtures/`.

## Contract tests

`packages/idlip/test/compiler/markup/`.

## Changes

- v1: initial draft.
