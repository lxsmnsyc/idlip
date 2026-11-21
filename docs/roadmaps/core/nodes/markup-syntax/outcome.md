# Outcome: markup-syntax

## Built

- `docs/proposals/0005-markup.md`: decisions, example, how a file is read, errors and spans, open questions.
- `docs/roadmaps/core/nodes/markup-syntax/markup-grammar.md`: proposed frozen contract text (EBNF, lowering table, segment table, error ids, block-to-component mapping). The orchestrator copies it to `contracts/markup-grammar.md`.
- `packages/idlip/test/compiler/markup/fixtures/`: paired `.idlip.txt` and `.tsx.txt` for `if`, `for`, `switch`, `try`, `head`, `listeners` (`<subscribe>`, `<window>`, `<document>`) and `todo`.
- `packages/idlip/test/compiler/markup/fixtures.test.ts`: each expected TSX passes `analyze()` with no errors, each block has a fixture, and sources never import block components.

## Deviations

- None. Grammar choices beyond the brief: `by` is required on `#for`, `#switch` takes conditions (brumate form), no `#for ... #else`, markup in expressions is an error.

## Stubs left

- Parser and lowering do not exist yet. The `.tsx.txt` files are hand-written expected output; `markup-parser` and `markup-lower` turn the pairs into tests.

## Gotchas

- The analyzer rejects `<For>`, `<Try>`, `<Head>` and `<Subscribe>` unless imported (`component-unknown`). The lowering appends the import as the last line.
- Block bodies lower to fragments, which the analyzer accepts.
- `<tr>` directly in `<table>` is `html-implied`; use `<tbody>`.

## Proposed learnings

- Fixtures are `.txt` so tooling skips them | some do not type-check on purpose | packages/idlip/test | no

## Open questions for the user

- One published package or separate tooling packages. Option A: `idlip` with subpaths, private extension. Option B: `idlip` plus `@idlip/language-core` and `@idlip/tsc`, private extension. Author leans to B for the tooling only.
- `#switch` form: condition form (chosen) or `#switch (expr)` with `#case (value)`.
- `#for ... #else` for empty lists (left out).
- Text whitespace: JSX rules (chosen) or as written.
- File suffix: `.idlip` imported as `./chart.idlip`, while `*.idlip.tsx` stays TSX.

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/markup`: 23 passed.
- oxlint and `tsc --noEmit` on the package: clean.

## Size

- Estimated M, actual M.

## Gate decision (orchestrator, one-shot run, 2026-11-21)

Landed as d0d6bf6 on `batch/core`. The contract `markup-grammar` v1 is frozen as proposed. Decided, for the user to revisit:

- Packages: option B. The parser and lowering stay in `idlip/compiler`; the editor tooling ships as `@idlip/language-core` and `@idlip/tsc`, with a private VS Code extension.
- `#switch` keeps the condition form (no discriminant), as in brumate.
- No `#for ... #else`; text whitespace follows JSX rules; the `.idlip` suffix as proposed.
