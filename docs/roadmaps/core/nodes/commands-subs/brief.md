---
id: commands-subs
title: Built-in commands and subscriptions
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: todo-resumes
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

# Built-in commands and subscriptions

## Goal

`Http.get`, `Storage.set`, `Focus.el`, `Time.every` and `Browser.on` as data, with their client executors loaded only when used. Active subscriptions start on resume from the list in the state script.

## Context

- Source: `docs/proposals/0002-modules.md`, Commands and subscriptions. A command that returns a result takes the receiving constructor by value (`Http.get(url, msg.gotTodos)`), with payload type `Result<T>`. A subscription carries the message it dispatches.

## Acceptance

- [ ] Each effect has a unit test in happy-dom.
- [ ] A subscription listed in the state script starts on resume without loading any update chunk.
- [ ] After a message, subscriptions start and stop to match the new model. The `subscriptions` function runs again only when a model path it reads changed, so most messages load no subscriptions chunk.
- [ ] `Http.get` takes an error tag. A failed request dispatches a message to it.
- [ ] `Browser.on(name, constructor, options)` subscribes to `window` and `document` events, with `event` placeholders and key filters (`docs/proposals/0004-effects-refs-errors.md`, Global events).
