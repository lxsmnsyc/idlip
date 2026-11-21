---
id: update-ops
title: Compile trivial handlers to ops run by the client runtime
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: write-sets
    kind: hard
    why: ops carry exact write sets in the manifest
  - on: keyed-writes
    kind: hard
    why: a toggle op targets one keyed item
  - on: benchmarks
    kind: hard
    why: the interpreter size must be measured before ops go on by default
---

# Compile trivial handlers to ops run by the client runtime

## Goal

Implement the Update ops section of `docs/proposals/0003-update-analysis.md`. Handlers that only set, toggle, add, push or remove compile to ops in the manifest, and the runtime applies them without loading a chunk. A compiler test checks ops and source handler return the same model over generated inputs. Off by default behind a compiler option until the size is known.
