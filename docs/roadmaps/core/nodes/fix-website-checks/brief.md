---
id: fix-website-checks
title: The website samples and tests pass again
status: done
priority: must
type: fix
story:
early: false
outline: false
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter website check:samples && pnpm --filter website test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-24
spent: 131000
owns:
  - website/test/**
shared:
  - website/docs/packages.md
  - website/docs/styles.md
  - website/src/repl/**
reserves: []
provides: []
depends_on: []
---

# The website samples and tests pass again

The website build is not in CI, so 0.1 work broke its checks without anyone seeing it (found by the website worker, 2026-11-24, failing the same way on main at 34d5bd1):

- `check:samples`: `packages.md:38` and `:68` report codegen-component (no component), `styles.md:71` reports a parse error (adjacent JSX).
- `test`: `repl.test.ts > compiles and renders todo` expects `./todo.module.css`; `site.test.ts > fails on a view the analyzer rejects` expects `hole-closure` but gets `let-function`.

For each failure, decide whether the sample or test is wrong or the code is. Fix the docs samples so they compile as shown (or mark them as non-compiling fragments the way other pages do), and update tests only when the new behavior is the intended one.

## Acceptance

- [ ] `pnpm --filter website check:samples` and `pnpm --filter website test` pass.
- [ ] `pnpm --filter website build` passes.

## Landed

Landed on main 2026-11-24 (87112b9, 745027c). The REPL drops only the todo example's two known stylesheets and throws on any other stylesheet use.
