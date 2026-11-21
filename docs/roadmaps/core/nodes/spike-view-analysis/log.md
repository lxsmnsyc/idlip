# Log: spike-view-analysis

- 2026-11-21: branch `spike/spike-view-analysis`, reset to `batch/core` (e3091cc). No earlier log, so not resuming. The brief has no `verify` command and no prototype existed, so the work was not already done.
- `oxc-parser` is not a dependency of `packages/idlip`. The prototype has its own `package.json` in `prototype/` with `oxc-parser` 0.154.0 (brumate's version), installed with `pnpm install --ignore-workspace`. Node 26 runs the `.ts` files directly.
- oxc 0.154 returns ESTree with `start`/`end`. `on:click` is a `JSXNamespacedName`. `satisfies T as T` is `TSAsExpression` over `TSSatisfiesExpression`, so the `let` type rule is a two-node check.
- The brumate page-format doc has no Elements section. The nesting list is in `../brumate/packages/brumate/src/nesting.ts` (BRM185). Ported it to `prototype/nesting.ts` and added the implied `<tbody>` and `<tr>` cases, which brumate allows.
- First run on the 0002 todo: 8 holes, all exact, 0 diagnostics.
- Stateless components analyzed on their own reported `props.children` and message props as errors. Fixed: on their own, children are an empty slot and `onX` props are prop targets.
- `<Subscribe on:value={tick}>` must pass the value. DOM `on:click={add}` passes nothing (0002). Recorded both in the IR: the subscription event gets one `$event` argument.
- No construct in the closed grammar needed `dynamic`. Aliases resolve because `const` is inlined. Computed keys resolve to `*` plus the key's paths.
- Root `pnpm lint` and `pnpm format:check` already fail on `batch/core` (debate evidence `.tsx` files and briefs). The prototype would add about 1250 lint errors (untyped AST access), so `prototype/.oxlintrc.json` ignores the folder. oxlint honors the nested `ignorePatterns`. Ran `oxfmt` on the folder.
- The brief says the spike freezes `contracts/view-ir.md`, but the worker rules forbid editing contracts. Wrote the frozen text to `view-ir.proposed.md` and a change request that points to it.
- Review round 1 (coordinator, fresh review). Rebased onto `batch/core` (root lint now ignores `docs/**`), deleted `prototype/.oxlintrc.json`.
- `run.ts` now runs the root `oxfmt` on `out/` so the JSON passes `pnpm format:check`. The parse-error fixture is `parse.idlip.tsx.txt`: `oxfmt` fails on a file that does not parse.
- Added the coordinator's allow-list: `String`, `Number`, `Boolean`, `Math.*` except `random`, 13 methods and `.length` on any value. New `Expr` kinds `method` and `property`, root `global`. `Math.random()` in a hole is `hole-impure`.
- Added `component-import` (import not from `.idlip.tsx`), `hole-dynamic` (never fires), event `modifiers` and the `form` root (reserved), props paths on handler free variables, and `fields` with the rename mapping on props patterns.
- Added cases to `violations.idlip.tsx`: 73 of 74 rule ids now fire. Only `hole-dynamic` has no case.
