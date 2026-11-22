# Change request: compiled-format v15 to v16

- From node: cloned-templates
- Status: proposed. The code on `node/cloned-templates` follows it.

## Problem

A list row and a condition branch render as an HTML string that the loader parses per row (`parseHtml`). Creating 1,000 rows spends 7.3 of 15.0 ms of script in `parseHtml`. A clone of a parsed `<template>` with the values written on its nodes takes 7.2 ms in total.

## Proposed change

- `ListChunk.render(scope)` returns `string | DocumentFragment`. A string is the row's HTML without the row markers, as before. A fragment is a clone that holds the row markers (`<!--i-->...<!--/i-->`) and the same nodes the HTML would parse to. `patchList` inserts a fragment as is and does not walk it for blocks: a cloned row holds no condition, list, child or other block.
- The local render function that a `c` export passes to `setBranch` returns `string | Node`. `setBranch(start, branch, render, ns?)` inserts a node as is and parses a string as before.
- New copied helpers: `clone$(template)` (imports `parseHtml` from the loader), `putAttr$(el, name, value)` and `putText$(node, value)`. A cloned chunk declares its template at module level as `template$` (list) or `templateC<id>_<branch>$` (condition branch): `{ h: '<static html>' }`. In the HTML, `i-x="<n>"` marks an element that gets a write and `<!--x<n>-->` a text hole. `clone$` removes both at the first parse.
- Which bodies clone: elements, static text and text holes in the HTML namespace, with at least one write. Everything else renders HTML (list in `nodes/cloned-templates/outcome.md`).
- No change to the loader's exports, the manifest, chunk names or the server output.

## Contract text

ListChunk: `render` returns `string | DocumentFragment`, with the rule above. DOM helpers table: `setBranch` render returns a string or a node; add `clone`, `putAttr`, `putText` to the copied helpers. Version history: add a v16 line.

## Affected nodes

- `perf-list-kept`: the kept-row pass (`findNodes`, `walk`, `patchRow`) is unchanged and is now the largest script cost of append.
