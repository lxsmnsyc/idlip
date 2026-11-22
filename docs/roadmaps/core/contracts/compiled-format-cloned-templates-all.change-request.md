# Change request: every client body clones a template

- From node: cloned-templates-all
- Status: proposed. The code on `node/cloned-templates-all` follows it. It builds on `compiled-format.v16.change-request.md` (cloned-templates) and `compiled-format-shared-helpers.change-request.md`.

## Problem

After `cloned-templates`, a row or branch with a child, a nested block, raw HTML, a `<Try>`, `<Subscribe>`, `<Head>`, a global listener, an SVG or MathML body, a hole in a text element or a `pre`, or nothing to write still rendered an HTML string that the browser parsed, and child views and catch views always did. The user decided (2026-11-22) that before 0.1 only raw HTML content stays a string.

## Proposed change

- Every client render clones: a list chunk's `render(scope, doc)`, a branch render, the `view` chunk's `render(scope, doc)`, the `try=<id>` chunk's `render(error, scope, doc)` and `region(scope, start)`. Each returns a `DocumentFragment` (a branch render returns a `Node`). HTML returns are gone.
- Templates: module-level `const template<kind><id>$ = { h, n, s? }`, printed once per chunk. Kinds: `L<id>` rows (the list chunk's own row was `template$`), `C<id>_<branch>` branches, `E<id>_0` / `E<id>_1` a region's body and catch view, `R<id>` a whole region for `reset`, `H<id>` the elements of a `<Head>`, `T<offset>` the content of an author `<template>`, `V` a child's view. `s` is `'svg'` or `'mathml'` for a body in that namespace; `clone$` parses the template inside the wrapper.
- Marks: `i-x="<n>"` on an element, `<!--x<n>-->` a text placeholder, and a comment `<!--<data>x<n>-->` that keeps `<data>` (a block's start or end): `<!--c<id>:x<n>-->` (the write appends the branch), `<!--/lx<n>-->` (rows go before it), `<!--n:x<n>-->` (the write appends the slot path), `<!--e<id>:x<n>-->` (the write appends the state).
- `setBranch(start, branch, render)`: `render(branch, doc)` returns a node; the `ns` argument is gone.
- `ListChunk`: `render` returns a fragment; `namespace` is gone (the template carries it); new `blocks?: true` when a row holds a block, so `patchList` runs the block hooks for new rows.
- `try=<id>` chunk: `namespace` is gone; `render` takes the document third; `region(scope, start)` always takes `start` and clones in its document.
- `addChild(path, module, view, props, doc)` returns the child's nodes (`view.render(scope, doc)`); the template holds the boundary comments. `ViewChunk.render(scope, doc)` returns a fragment.
- The only markup a chunk parses is the value of `html=`: the `a` binding (`el.replaceChildren(...parseHtml(...))`, as before) and a cloned element with raw content (`el.append(...parseHtml($doc, value, ns))`).
- Server output: a `pre` or `listing` with children starts with a newline, as a `textarea` did, since the parser drops one there. Text in a `colgroup` is the error `html-nesting`, as in a table.
- Loader: `HAS_INNER_LISTS` (new flag) makes `patchList` skip a list that a branch swap in the same patch rendered from the new model (fix of a crash on the base, both render paths).

## Contract text

ListChunk, ViewChunk, the try chunk and `addChild`: the signatures above. DOM helpers table: `setBranch(start, branch, render)` with a node render; `clone`, `putAttr`, `putText` as in v16, and `getText` for text elements. Version history: one line for this request. Feature flags: `HAS_INNER_LISTS`.

## Affected nodes

- `perf-list-kept`: unchanged kept-row pass; rows that hold blocks now walk for blocks on insert (`blocks`), as HTML rows did.
- Website REPL and live samples serve the same chunks; no change needed there.
