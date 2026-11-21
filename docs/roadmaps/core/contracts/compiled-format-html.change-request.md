# Change request: compiled-format, raw HTML binding

From node `svg-and-html`.

Status: applied on 2026-11-21 by the curator, from the code on `batch/core`.

The contract's Reserved section said a raw HTML binding is the export `h<id>`. The built binding is an element binding, `a<id>`.

## Change

In Reserved, replace "A raw HTML binding, export `h<id>`, that sets `innerHTML` from a `TrustedHtml` value (`svg-and-html`)." with:

- An element with `html={trusted(value)}` has one element binding, export `a<id>`, listed in the element's `i-a`. It replaces the element's content with the parsed value. The server writes the value as is between the tags, with no markers. The binding is generated only when the value reads state. The binding calls the loader's `parseHtml`, which holds the one Trusted Types policy `idlip`, so the loader grows by no bytes and needs no `HAS_*` flag.

## Why

- The loader finds an element by `i-a` and the name `a<id>`. A new prefix `h` would need a second case in `buildIndex` and in `findNode`, which costs loader bytes on every page, for no gain.
- Nothing else changes: the manifest, groups and lists treat the binding like an attribute binding.
