---
id: short-chunk-names
title: Name build chunks by a short hash instead of their readable path
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/src/vite/**
  - packages/idlip/test/vite/**
shared:
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/server/**
  - packages/idlip/src/client/**
  - e2e/**
  - website/src/landing/**
  - website/src/demo/**
  - benchmarks/**
reserves: []
provides: []
depends_on:
  - on: multi-component-files
    kind: hard
    why: settles the logical chunk names this node hashes
  - on: shared-helpers
    kind: hard
    why: both change the emitted chunk set; measure after it
---

# Name build chunks by a short hash

User idea (2026-11-22): name chunks with a non-cryptographic hash such as xxh32 instead of readable paths.

Today a build chunk is `assets/todo.binding.todos._.done.j_yJel90.js`: the readable name from `getChunkFile` (`core/format.ts`) plus Vite's content hash. The page state (`<script i-state>`) carries the manifest and the chunk URLs; in the website's todo demo the state is 2,253 B raw and about 20 URLs of 40 to 50 B each. Readable names cost bytes in every page and do not help users. With several components per file (`multi-component-files`) the names get longer still.

## Do

- In production builds, emit chunk files under a short name: the content hash alone (`assets/<hash>.js`), or an xxh32 (or similar) of module path + component + chunk id, base36/base64url. Pick by measurement. Content hash gives cache busting for free; an id hash needs Vite's content hash too, or a build id, for cache busting (see `deploy-skew` and `.idlip/builds.json`).
- Consider shortening the manifest keys in the state too (`handler=toggle`, `binding=todos.*.done`), if the loader can work with short ids, keeping the paths the diff needs.
- Collisions: 32 bits is not enough to ignore (about 1% for 10,000 chunks). Detect a collision at build time and fail with a clear error or lengthen the hash. Test it with a forced collision.
- Dev (`vite dev`) keeps readable names. The build writes the readable-to-short map into `.idlip/chunks.json` (it already exists) for debugging and the REPL.
- The REPL and the landing diagram show chunk names. Keep them readable there (they are dev-like builds), or show both.

## Acceptance

- Page state bytes (raw and gzip) before and after for the todo demo and the dashboard benchmark, in outcome.md. Keep the change only if it saves bytes.
- No collision in any build in the repo; forced-collision test passes.
- e2e first-click request counts unchanged.
