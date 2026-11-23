# Debate: a markup DSL or TSX as the one source syntax

Status: settled by the judge, 2026-11-21. The user asked the debate to settle it ("the purpose of the debate is to settle it"). Ledger: `ledger.json`. Evidence: `evidence/`.

## Settled structure

TSX stays the one source syntax (option B). A component is a function component in a `*.idlip.tsx` file: `let` is state, `const` is derived, function declarations are handlers, and the `return` is the view (`docs/proposals/0002-modules.md`). There is no markup DSL, no `.idlip` file type, and no `@idlip/language-core`, `@idlip/tsc`, language server or VS Code extension.

## Why

- The user framed the choice (J11, Q1, Q2): a DSL means an Elm-like component structure, not the TSX structure in other punctuation. Otherwise keep what exists.
- Effects stay `await` in update code (J12, the user's answer to Q3). With that, every construct of the Elm-like proposal (P9) lowers one-to-one onto a B construct (O13): a `model {}` record for the `let` fields, `update` arms for handler functions, `on:click={Toggle(id)}` for `on:click={() => toggle(id)}`. None of Elm's core traits remain (a pure update, effects as commands). That is the middle form J11 rules out.
- Cost of the cheapest A route: about 2.0M tokens (O11, range 1.9M to 2.1M), and the docs and website start about 5 waves later (O6). B costs nothing more (P7, J1).
- Authoring gain: low (O12, O13). Labelled sections, and the end of the `satisfies T as T` workaround for TS2367.

## Budget

- tokens: 0 new for the syntax. The debate cost about 600k tokens over two rounds.
- time: the website and docs nodes start now, without waiting on a syntax story.
- device: no change (J8).

## Rejected alternatives

- Option A, Elm-structured `.idlip` with TS update bodies (P9 to P13): rejected by O11, O12, O13 and O6.
- Option A with the v1 tooling reused (P4, P6): rejected by O3 and O4, then withdrawn in P8.
- The v2 sketch (the TSX structure in a markup-first file): excluded by the user (J11).
- The v1 DSL on `feat/markup-frontend` (a TS function returning JSX with `#` blocks): rejected by the user as "sticking with TSX".

## Roadmap changes

- Dropped: the `markup-frontend` story and all its children (`markup-parser`, `markup-lower`, `markup-compile`, `markup-language-core`, `markup-vscode`, `markup-example`, `markup-syntax-v2`, `markup-v2`, `markup-port`, `markup-only`) and `markup-ts-plugin` (cuts O7, O8). `feat/markup-frontend` stays as history; nothing of it is merged.
- `markup-syntax` (landed on `batch/core`) is retired: proposal 0005 is marked rejected, the `markup-grammar` contract is retired, and its fixtures are removed.
- `release-0-1` and the website nodes no longer wait on the markup story; pages show TSX.
- `GOAL.md`: views are TSX, the one source syntax; `idlip` is one package with subpaths.
- Decision 7 and the P3 overrule of `debate/debate.md` are superseded.

## Open risks

- The `satisfies T as T` workaround stays in B. A small node can look for a TSX-side fix (O13 found the cause: TS narrows an initialized `let`).

## Inferred choices

- J13: a lowering that authors never see is a step inside one compiler (not asked).
