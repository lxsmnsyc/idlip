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
  - on: routing
    kind: hard
    why: actions answer per route
---

# Send data to the server: server functions and form actions

Events only change the client model. Saving data means a hand-written `fetch` in an async handler, with no help for forms, validation, redirects, CSRF or refreshing data after a change. Brumate has server functions, form actions, validation with Standard Schema, rate limits and `refresh`.

Read first: brumate `server-functions.md`, `forms.md`, `security.md`, `reference-security.md`. To settle when refined: how a server call fits MVU (an effect whose result is a message), progressive enhancement of forms (posting without the loader), how a mutation refreshes server data (ties into `concurrency-model`), security defaults.
