# Log: brumate-lessons

## Method

- Read the brief, `docs/roadmaps/core/CLAUDE.md`, `GOAL.md` and the brief of `cloned-templates` (it maps to brumate commit `4b5e93a3`, checked with `git show`).
- Brumate sources: `docs/performance.md`, `docs/decisions.md`, `docs/roadmaps/brumate/nodes/{perf-pass-0.4,size-baseline,values-spike,client-audit,no-html-string-fallback,differential-render-test,loader-preload-spike,clone-remaining-bodies}`, and the `perf:` commits of 2026-10-21 to 2026-10-27 (`git log --no-merges`).
- idlip sources: `packages/idlip/src/client/list/index.ts`, `client/patch/*.ts`, `client/loader/*.ts`, `server/render.ts`, `server/preload.ts`, `compiler/view/codegen/html.ts`, `benchmarks/README.md`, and the outcomes of `perf-list-create`, `perf-ssr-state`, `bench-rows`, `spike-chunk-split`, `spike-chunk-merge`, `chunk-helpers`, `prefetch`.
- No build, no benchmark, no code change. Every number is copied from a brumate or idlip document, with its source named in `outcome.md`.

## Findings worth keeping

- Brumate wrote "Templates ... measured and not done" in `docs/performance.md` on 2026-10-24 and did the clone work the next day (`4b5e93a3`, then 15 more `perf:` commits). Its own estimate before doing it was 2 to 3 ms per 1,000 rows.
- Brumate's rows script time for create 1,000 is 2.95 ms in `values-spike/outcome.md` and 6.3 ms in `perf-pass-0.4/outcome.md`. idlip's is 12.9 to 16.5 ms (`perf-list-create/outcome.md`).
- `renderPreload` exists (`server/preload.ts`) and no benchmark app calls it (grep over `benchmarks/idlip/*/src` and `benchmarks/harness` finds nothing).
- idlip has no differential test of the server render against the client render. `grep -ril differential packages/idlip/test e2e` finds nothing.
- `patchRow` is `async` and awaited once per kept row (`client/list/index.ts:168,304`).

## Not checked

- Whether the idlip dashboard state script still holds a 37.5 kB chunk map after `perf-ssr-state` (the outcome says the map keeps its flat keys, and gives only the total of 65,291 B).
- Any claim marked "guess" in `outcome.md`.
