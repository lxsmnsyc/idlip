---
id: multi-root
title: Several idlip roots on one page
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
  - on: resume-loader
    kind: hard
    why: shares one loader and one set of listeners
  - on: ssr-render
    kind: hard
    why: writes one state script per root
---

# Several idlip roots on one page

## Goal

Render several modules on one page, each with its own state script and model, served by one loader and one set of delegated listeners. The manifest stays per render call, not module-global.
