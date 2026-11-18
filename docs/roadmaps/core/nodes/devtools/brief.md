---
id: devtools
title: Message log and time travel devtools
status: todo
priority: could
type: feature
story:
early: false
outline: true
milestone:
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
added:
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: example-todo
    kind: hard
    why: needs the working runtime
---

# Message log and time travel devtools

## Goal

MVU makes every state change a message. Record them, replay them, and show the model at each step.
