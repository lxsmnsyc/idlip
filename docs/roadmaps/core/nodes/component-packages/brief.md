---
id: component-packages
title: Compile idlip components from npm packages
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
added: 2026-11-23
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Compile idlip components from npm packages

The plugin compiles `src/**/*.tsx` by default, so idlip components published to npm are not compiled. Shared component libraries need a rule: a package field (for example `"idlip": "./src"`) that the plugin reads, or publishing compiled output. Read brumate `packages.md`.
