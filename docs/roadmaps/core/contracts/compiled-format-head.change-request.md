# Change request: compiled-format, `<Head>` markers

- From node: document-head
- Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Problem

v10 reserves "head block markers and the title rule" but fixes neither the markup, how the server hands the head elements to the host, nor how the loader tells a block's elements apart. `render()` returns one string, so it has no place for head output.

## Proposed change

- `Manifest.head?: true`: present when the view has a `<Head>`. The loader flag `HAS_HEAD` is on when any module has it.
- Body marker: `<!--c<id>:h--><template i-head="<n>" i-a="<ids>"></template><!--/c-->`. `<id>` is unique in the module. `:h` tells the loader this block is a head block. `<n>` is the block number. `i-a` lists the bindings of the block's elements, and the marker is their node.
- Head elements: each element of the block, in `<head>`, carries `i-head="<n>.<index>"`, where `<index>` counts the elements of that `<Head>` from 0. The server writes them. A `<Head>` holds elements only, and at most one `<title>` (`head-title-twice`).
- Client templates: a block that a patch adds writes the elements inside the marker, `<template i-head="">...</template>`. The block hook picks a number above every `i-head` on the page, writes `<n>.<index>` on each element, moves them into `document.head` and writes `<n>` on the marker. The remove hook removes the elements whose `i-head` starts with `<n>.`. Blocks in rows and conditions use the same hooks (`onBlock`).
- Bindings: `a<id>` binds with the marker as `el`. The chunk finds the element with `[i-head="<n>.<index>"]`. An attribute hole calls `setAttr`. A title with a state hole is one binding that sets the whole text, since a title holds no comments. This replaces the `t` binding that v10 describes for a hole in `<title>` when the title is in a `<Head>`.
- Title: the last `<title>` of the page wins, as in proposal 0004. The page order is the order of the markers in the body, so no state is kept per block. The loader finds, for each marker in order, its title in `<head>` (`title[i-head^="<n>."]`) and puts the last one first in `<head>`, where `document.title` reads it. It watches `<head>` with a `MutationObserver`, so a text change reaches `document.title`. Server blocks have digit numbers in render order. A block that a patch adds gets `p<counter>`.
- Server: `RenderContext` gains optional `headId(): number`, `head(id, markup, title?)`, `headMark(): number` and `headRollback(mark)`. Generated code calls them with `?.`, so a custom context without them still renders. A `<Try>` body takes a mark first and rolls back to it in its `catch`, so a failed body leaves no head output. `renderPage(component, props, options)` from `idlip/server` returns `{ head, body }`. `head` has the last title first, then the other elements in markup order, then the other titles. `render()` still returns the body string. In DEV it warns when the page has head output, since it drops it.
- Host: write `head` inside `<head>` and `body` in `<body>`.
- Test harness: `mount` puts the head output in `document.head`, `stop` removes it, and `compareTrees` ignores `i-head`.

## Affected nodes

`compile-integration` and `vite-plugin` (the `HEAD` detector), `testing-mount` (the harness change above), `errors` (shares `onBlock`).

## Workaround in place

Implemented in `src/client/head.ts`, `src/compiler/view/codegen/head.ts`, `src/server/render.ts` and `src/core/format.ts`.

## Decision

Applied in v11 from the landed code.
