---
id: routing
title: File routes and layouts
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
  - on: entry-setup
    kind: hard
    why: routes render through the document entry it built
---

# File routes and layouts

User request (2026-11-23). An app has more than one page. Routes map URLs to components, and layouts wrap the routes of a folder, so the document skeleton (`<html>`, `<head>`, `<body>`) is written once in a root layout instead of in every root component. This replaces the stateless `<Document>` layout idea that was set aside in `entry-setup` (decision 14).

Read first: brumate `website/docs/routing.md` (`_layout.brm`, `[id]` params, `_error`, named slots), `navigation.md` (client navigation, layouts keeping their state), `reference-routes.md` and `virtual:brumate/routes` (`handle(request)`). Then `nodes/entry-setup/outcome.md` and `proposal.md` for the entry, the document rules and the Nitro setup.

To settle when refined, as a debate or a spike: file routes or a route table in TSX (TSX only, no compile-time marker APIs); how a layout and a page share or isolate their models in MVU; whether navigation between pages is a full load or a client swap that resumes the next page's state; params and props from the request; how layouts keep the loader budget (a layout with a stateful page inside must not turn on child-component code, the cost `entry-setup` measured at +857 B).
