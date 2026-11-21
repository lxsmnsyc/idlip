---
id: ssr-render
title: Server renderer and state serialization
status: active
priority: must
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
verify: pnpm --filter idlip exec vitest run test/server
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/server/**
  - packages/idlip/test/server/**
shared: []
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
  - on: compiled-format
    kind: contract
    via: compiled-format
---

# Server renderer and state serialization

## Goal

`idlip/server` renders a compiled module to HTML for a model: markers, event attributes, the seroval state script and the subscription list, as `contracts/compiled-format.md` defines.

## Context

- Input and expected output: `packages/idlip/test/fixtures/*/`.
- Its dependencies are installed by `core-api`. Do not edit `packages/idlip/package.json`.

## Acceptance

- [ ] For both fixtures, rendering the fixture model gives the fixture HTML.
- [ ] Text and attribute values are escaped. A test covers a model string with `</script>`, `<!--`, `"` and U+2028.
- [ ] A `nonce` render option is written on the state script and any inline script.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: format is fixed, escaping and seroval output need care.
