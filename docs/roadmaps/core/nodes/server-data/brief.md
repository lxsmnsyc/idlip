---
id: server-data
title: Send data to the server: server functions and form actions
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
size: XL
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
depends_on:
  - on: server-only-code
    kind: hard
    why: server functions extend the build guard
---

# Send data to the server: server functions and form actions

Events only change the client model. Saving data means a hand-written `fetch` in an async handler.

Decided with the user (2026-11-23), after brumate `server-functions.md`:

- `'use server'` at the top of an `async` function, or at the top of a `.ts` file (every export), makes a server function. It is a string directive, not an import, so it keeps the no-compile-time-API rule.
- `'use server'` is the only server-only marker. A `'use server'` module never reaches a client chunk; the client gets a call stub.
- A handler calls one like any async function: `await saveTodo(text)`. This is the existing effect model; the result is assigned to the model like any awaited value.
- Not tied to routing: a server function has its own endpoint. Form actions that answer per route wait for `routing`.

To settle when refined: the wire protocol and serialization of arguments, results and errors (seroval), errors reaching `<Try>`, form actions and posting without the loader, validation (Standard Schema), CSRF and other security defaults, refreshing server data after a change (ties into `concurrency-model`), rate limits.
