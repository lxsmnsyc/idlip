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

## Updates after wave 9

- An ops entry has no `chunk`. `renderPreload` (`prefetch`) names `handlers[tag].chunk` and `bindings` from `manifest.listens`: skip an entry without a `chunk` and still name its `bindings`. `HandlerEntry` in `format.ts` and `compiled-format` v11 (Manifest) must change together.
- Steps now carry `$step?: true` and `after` (`dom-refs`), tested with `'$step' in result` in `client/loader/resume.ts`. An op that stands for a handler with `Dom` calls or a task is not an op: keep it a chunk.
- The interpreter is loader code, so it needs a `HAS_OPS` flag (three edits, `src/client/CLAUDE.md`) with its flag-on cost measured. Flag costs so far are in `reviews/wave-9.md`: tasks +274 B, keyed +124 B, children about +650 B, refs about +550 B, subs +937 B, head +307 B, errors and retry +606 B, skew +60 B, dynamic +122 B.
- `$dynamic` is listed in `bindings` of every handler that has a write set. An op entry keeps it.
- Tests wait with `settled` or `until` of `idlip/testing`, never a fixed delay.
