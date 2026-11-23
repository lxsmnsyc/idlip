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

Starting point from the discussion (2026-11-23), to challenge, not to adopt:
- Promises only at the edges: the render functions accept props where a field may be a promise; handlers `await`. Component code and the model never hold a `Promise`.
- The runtime keeps one explicit pending set: unresolved props on the server, paths an awaiting handler will write on the client (its write set).
- A pending read suspends per read site, not per component: each hole that reads a pending path, directly or through a derived `const`, falls back to the nearest enclosing boundary in the JSX (`<Loading fallback>` or another name). No boundary: the server waits before the first flush; the client keeps the old value.
- Errors go to `<Try>`. Events whose handler reads a pending path wait for it; latest wins.
- Open: a dev warning when a read outside any boundary makes the page wait, or an opt-in type (`Deferred<T>`) that makes it a compile error; refresh behaviour (stale content vs fallback, an `isPending`-like signal without a compile-time API); transitions between two model states; ordering of overlapping tasks; cancellation.

Prior art to weigh: Elm (Task, Cmd, RemoteData), Hyperapp v2 effects, React (`use`, Suspense, transitions), Solid 2 (async memos, `<Loading>`, `isPending`), brumate (`#loading`, named memos), Marko 6 (`<await>`), Qwik (`useResource$`).

Run it as a goal debate (proponent, opponent, judge) and end with a design record for the user to approve, then refine `stream-model` from it. User rules apply: TSX only, no compile-time marker APIs, one explicit union per lifecycle, check brumate first.
