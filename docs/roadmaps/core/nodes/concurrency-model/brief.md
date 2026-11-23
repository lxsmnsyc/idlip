---
id: concurrency-model
title: Design the concurrency model and the loading UI
status: todo
priority: must
type: docs
story:
early: false
outline: true
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Design the concurrency model and the loading UI

User request (2026-11-23): before streaming data, settle how idlip handles values that are not ready yet, on the server and on the client. The user does not yet know the best design for loading UI.

Settled with the user (2026-11-23): `design.md` in this folder. A promise is a model value. Async components suspend as a whole, with `<Loading>` in the parent. Overlapping assignments resolve as latest wins. Rejections go to `<Try>`. Its "Open" list is what the debate settles.

Prior art to weigh: Elm (Task, Cmd, RemoteData), Hyperapp v2 effects, React (`use`, Suspense, transitions), Solid 2 (async memos, `<Loading>`, `isPending`), brumate (`#loading`, named memos), Marko 6 (`<await>`), Qwik (`useResource$`).

Run it as a goal debate (proponent, opponent, judge) and end with a design record for the user to approve, then refine `stream-model` from it. User rules apply: TSX only, no compile-time marker APIs, one explicit union per lifecycle, check brumate first.
