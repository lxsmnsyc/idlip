---
id: brumate-lessons
title: Map what brumate learned to idlip
status: todo
priority: should
type: experiment
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-22
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Map what brumate learned to idlip

The user: "I feel like you'll learn a lot from brumate." idlip repeated at least one design brumate already moved away from (HTML strings for client-rendered blocks, see `cloned-templates`). Find the others before they cost a benchmark round each.

Read-only research. Sources in `/Users/alexis/Documents/GitHub/brumate`:
- `docs/performance.md`, `docs/decisions.md`, `docs/architecture.md`, `docs/compiler.md`.
- `git log` for `perf`, `fix`, and revert commits; the benchmark README.
- Its client runtime (`packages/brumate/src/runtime/`), list and block code, loader.

For each lesson (a measured cost, a design change, a bug class, a rejected idea with its reason), check idlip's code (`packages/idlip/src/`) and benchmarks (`benchmarks/README.md`, node outcomes under `docs/roadmaps/core/nodes/*/outcome.md`): does idlip have the same problem, already avoid it, or not apply? Cite files and lines on both sides.

Known lessons to check at least: per-row `querySelector` (quadratic create), moves without a longest increasing subsequence, re-running updates of freshly rendered scopes, loader rescans (MutationObserver) after insert, re-importing preloaded modules on first click (an `import()` of a loaded module still resolves in its own task), cloned templates, preloading bundles on start vs per-click fetch (brumate moved to loading code at start: compare with idlip's per-click fetch cost in the dashboard benchmark, 3 requests, 47 ms vs 18 ms), the helper copying and chunk count.

Output in `nodes/brumate-lessons/outcome.md`: a table (lesson, brumate evidence, idlip status with file:line, expected gain, proposed node or "covered by <node>"), sorted by expected gain. Do not change code. The orchestrator turns rows into nodes after the user reviews (this node is a gate).
