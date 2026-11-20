---
id: deploy-skew
title: Recover when cached HTML meets a newer client build
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
    why: writes the build id and keeps old assets
  - on: resume-loader
    kind: hard
    why: detects the mismatch on chunk load
---

# Recover when cached HTML meets a newer client build

## Goal

A page served from a cache can name chunks that a newer deploy removed. The HTML carries a build id. When a chunk fails to load and the server reports a different build, the client reloads the page once per build per tab. `vite-plugin` keeps the assets of the last two builds. Brumate does this in `../brumate/packages/brumate/src/runtime/skew.ts` and `../brumate/packages/brumate/src/runtime/client/references.ts`.
