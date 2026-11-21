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
  - on: markup-ts-plugin
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
  - on: markup-frontend
    kind: hard
    why: 0.1.0 ships the final view syntax, so users do not migrate from TSX
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
---

# Release 0.1.0

## Goal

Set `idlip` to `0.1.0`, set up npm trusted publishing (`npm trust github idlip --file release.yml --repo lxsmnsyc/idlip --allow-publish`), and let changesets publish from CI with provenance.
