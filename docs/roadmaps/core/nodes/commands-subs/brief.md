---
id: commands-subs
title: Subscriptions and global events
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/effects
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/effects/**
  - packages/idlip/test/effects/**
shared:
  - packages/idlip/src/index.ts
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: resume-loader
    kind: behavior
    via: compiled-format
---

# Subscriptions and global events

## Goal

Timers, sockets and `window` or `document` listeners that live across messages, once their design is decided: `docs/proposals/0004-effects-refs-errors.md`, Open questions, Subscriptions and global events. The candidate is a runtime call in a handler that starts the subscription and returns a plain handle kept in an explicit union in state, a `stop(handle)` call, and a restart of every handle in the state script on resume. No subscription is inferred from the model. Write the full brief after the design is accepted.
