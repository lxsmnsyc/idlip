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
  - on: website
    kind: hard
    why: 0.1.0 ships with docs
  - on: example-todo
    kind: hard
    why: 0.1.0 ships the first milestone
  - on: commands-subs
    kind: hard
    why: 0.1.0 includes the built-in effects
  - on: prefetch
    kind: hard
    why: 0.1.0 includes prefetching
  - on: benchmarks
    kind: hard
    why: 0.1.0 publishes benchmark numbers
  - on: nesting
    kind: hard
    why: 0.1.0 includes nesting
---

# Release 0.1.0

## Goal

Set `idlip` to `0.1.0`, set up npm trusted publishing (`npm trust github idlip --file release.yml --repo lxsmnsyc/idlip --allow-publish`), and let changesets publish from CI with provenance.
