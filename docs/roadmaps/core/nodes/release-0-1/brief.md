---
id: release-0-1
title: Release 0.1.0
status: todo
priority: should
type: release
story:
early: false
outline: true
milestone: 0.1
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: server-only-code
    kind: hard
    why: build errors added after the release would break shipped apps (user decision 2026-11-23)
  - on: fix-style-object
    kind: hard
    why: style objects render as [object Object]
  - on: component-styles
    kind: hard
    why: CSS imported by components is dropped today (user decision 2026-11-23)
  - on: component-packages
    kind: hard
    why: component libraries ship in 0.1 (user decision 2026-11-23)
  - on: entry-setup
    kind: hard
    why: 0.1 ships the whole-document entry (user decision 2026-11-23)
  - on: render-stream
    kind: hard
    why: entry-setup builds on it
  - on: event-callbacks
    kind: hard
    why: ships before 0.1 (user decision 2026-11-23)
  - on: shared-templates
    kind: hard
    why: ships before 0.1 (user decision 2026-11-23)
  - on: fix-string-length
    kind: hard
    why: a binding on a string length must patch
  - on: cloned-templates-all
    kind: hard
    why: every block body except raw HTML clones before the first release
  - on: differential-render-test
    kind: hard
    why: ships in 0.1.0
  - on: preimport-chunks
    kind: hard
    why: ships in 0.1.0
  - on: text-anchor
    kind: hard
    why: ships in 0.1.0
  - on: brumate-lessons
    kind: hard
    why: its findings may add work before the first release
  - on: cloned-templates
    kind: hard
    why: client rendering of new blocks changes before the first release
  - on: short-chunk-names
    kind: hard
    why: the chunk naming changes before the first release
  - on: for-key-callback
    kind: hard
    why: the <For> API changes before the first release
  - on: plain-tsx
    kind: hard
    why: the file convention changes before the first release
  - on: multi-component-files
    kind: hard
    why: the module format changes before the first release
  - on: shared-helpers
    kind: hard
    why: the chunk format changes before the first release
  - on: safe-urls-2
    kind: hard
    why: ships in 0.1.0
  - on: fix-flaky-tests-2
    kind: hard
    why: ships in 0.1.0
  - on: safe-urls
    kind: hard
    why: 0.1.0 must not ship javascript URLs from model data
  - on: errors-client
    kind: hard
    why: ships in 0.1.0
  - on: loader-trim
    kind: hard
    why: ships in 0.1.0
  - on: runtime-flags
    kind: hard
    why: ships in 0.1.0
  - on: custom-effects
    kind: hard
    why: ships in 0.1.0
  - on: dom-refs
    kind: hard
    why: ships in 0.1.0
  - on: document-head
    kind: hard
    why: ships in 0.1.0
  - on: svg-and-html
    kind: hard
    why: ships in 0.1.0
  - on: website
    kind: hard
    why: 0.1.0 ships with docs
  - on: example-todo
    kind: hard
    why: 0.1.0 ships the first milestone
  - on: commands-subs
    kind: hard
    why: 0.1.0 includes subscriptions
  - on: prefetch
    kind: hard
    why: 0.1.0 includes prefetching
  - on: benchmarks
    kind: hard
    why: 0.1.0 publishes benchmark numbers
  - on: nesting
    kind: hard
    why: 0.1.0 includes nesting
  - on: dynamic-paths
    kind: hard
    why: 0.1.0 accepts views whose paths the analysis cannot resolve
  - on: form-fields
    kind: hard
    why: 0.1.0 includes form field placeholders and Dom commands
  - on: deploy-skew
    kind: hard
    why: 0.1.0 pages must survive a deploy while cached
  - on: testing-mount
    kind: hard
    why: 0.1.0 ships a test helper for users
  - on: hmr
    kind: hard
    why: 0.1.0 dev server keeps the model on edits
  - on: errors
    kind: hard
    why: 0.1.0 reports handler and command errors
  - on: write-sets
    kind: hard
    why: ships in 0.1.0
  - on: global-events
    kind: hard
    why: ships in 0.1.0
  - on: stock-sources
    kind: hard
    why: ships in 0.1.0
  - on: nesting-format
    kind: hard
    why: ships in 0.1.0
  - on: spike-chunk-merge
    kind: hard
    why: ships in 0.1.0
  - on: perf-from-bench
    kind: hard
    why: 0.1.0 ships the fixes for the benchmark gaps
  - on: fix-global-late-listener
    kind: hard
    why: 0.1.0 must not drop global listeners added by a patch
  - on: fix-for-prop-each
    kind: hard
    why: 0.1.0 must update row holes in prop lists
---

# Release 0.1.0

## Goal

Set `idlip` to `0.1.0`, set up npm trusted publishing (`npm trust github idlip --file release.yml --repo lxsmnsyc/idlip --allow-publish`), and let changesets publish from CI with provenance.

## Updates after wave 9

- The batch cut into `main` (PR #1) comes first: nothing here starts before it merges.
- Defaults the changeset and the README must state: `skew` is on (serve `build.js` with `no-store`, keep `outDir` between deploys), prefetch is opt-in (`renderPreload`), `render()` drops head output (use `renderPage`), URL attributes drop `javascript:` URLs, form submits are prevented, `idlip/testing` rethrows an error a `<Try>` caught unless `expectCaught`.
- Contracts are at `compiled-format` 11, `core-api` 11 and `view-ir` 11 and match the code. The loader with no optional features is 3881 B gzip against the 4096 B contract.
- Not built, so not in 0.1 unless a node is added: `Step.send`, `let-reserved`, tracked dynamic holes in rows, branches and children.

## After debate `debates/dsl` (2026-11-21)

TSX stays the one source syntax. Pages and examples use `*.idlip.tsx`; no markup DSL, no `@idlip/language-core` or `@idlip/tsc`.
