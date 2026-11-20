---
id: hmr
title: Hot updates that keep the model
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
  - on: vite-plugin
    kind: hard
    why: hooks into the plugin's chunk invalidation from spike-chunk-split
  - on: resume-loader
    kind: hard
    why: swaps chunks in the running loader
---

# Hot updates that keep the model

## Goal

In `vite dev`, an edit to a handler or a binding swaps the chunk and keeps the model. An edit that changes markup renders the page again on the server with the current model. Brumate's version is `../brumate/packages/brumate/src/runtime/hot.ts`.
