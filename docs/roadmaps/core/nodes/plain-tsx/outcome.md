# Outcome: plain-tsx

## What changed

- The `.idlip.tsx` extension is gone. The Vite plugin compiles every `.tsx` file that the `modules` globs match. Default `src/**/*.tsx`.
- A `.tsx` file outside the globs is plain TSX and passes through to Vite.
- The analyzer takes a component import from any source that ends in `.tsx`. Another source gives `X comes from Y, which is not a .tsx file`.
- Rendering a component from a `.tsx` file outside `modules` fails the build with: `/src/board.tsx renders a component from /lib/counter.tsx, which the idlip plugin does not compile. Add the file to the `modules` option of idlip(), for example `modules: ['src/**/*.tsx']`.`
- Renamed 28 `*.idlip.tsx` files and 10 analyzer fixtures (`*.tsx.txt`). Updated tests, expected outputs, examples, benchmarks, e2e, website docs, REPL, landing, demo and proposals.
- `getting-started.md`, `reference/vite.md` and `nesting.md` describe the new rule.
- New test `packages/idlip/test/vite/plain-tsx.test.ts` covers a child in the globs, the diagnostic, and same-named files in two folders.

## Decisions

- The option is named `modules`, not `include`. The diagnostic names `modules`. Renaming the public option was not asked for.
- Chunk names use the file base name, as before (`todo.handler.toggle`). Two files `a/todo.tsx` and `b/todo.tsx` share the prefix, and Rolldown adds a hash to keep the files distinct. The module id in the URL map is the full path. The new test covers it. This is the behavior with `.idlip.tsx` too.
- Removed the check that a compiled module uses a feature the client build dropped. It only fired for a compiled module outside `modules`, which no longer exists.
- Proposal 0005 (the `.idlip` markup file) keeps its `.idlip` text. It is a different file type.

## Checks

- `pnpm --filter idlip build` ok. `pnpm --filter idlip test` 671 passed.
- `pnpm --filter website build` 28 pages. `pnpm --filter website test` 66 passed. `check:samples` 47 samples, 0 problems.
- Benchmarks `build`, `build:rows`, `build:dashboard` and `build:scale` build.
- `pnpm -C e2e test` 18 passed, including the todo first-click chunk spec.
- `git grep idlip.tsx` is empty outside `docs/roadmaps/**`.
- `pnpm lint` still reports errors in `website/test/chart.test.ts` and `website/src/landing/benchmarks.ts`. They are outside this node and were not touched.

## Left

- Nothing from the brief.

## Follow-ups

- A project whose components live outside `src` needs a matching `modules` glob.
