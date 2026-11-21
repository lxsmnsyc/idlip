# Log: docs-reference

- Started from `batch/core` at 0e596c0. No reference pages existed.
- No editor package on `batch/core` (no `packages/vscode`, no TS plugin, no `idlip-tsc`). `editor.md` covers `tsconfig.json`, plain TypeScript in the editor and where compiler diagnostics show.
- Read exports from `packages/idlip/dist/**/index.d.ts` after `pnpm --filter idlip build`. 94 exports over 7 subpaths.
- Added `website/scripts/reference/check-exports.ts`: each export needs an h3 heading on its page whose text is the name in code, and each such heading must be an export. Tried a renamed heading: it reports both sides.
- Diagnostics table: the `view-ir` v11 table plus rule ids found in the compiler source and missing from the contract (`attr-event`, `html-element`, `srcdoc-trusted`, `head-title-twice`, `try-catch-node`, `handler-props-unlisted`, `codegen-component`, `codegen-event`, `codegen-raw-text`, `codegen-unsupported`). `handler-derived-stale` is a warning in the source, and the contract's summary line misses it.
- Ran the testing page sample as a throwaway test: `loaded()` order is `binding=count`, `handler=increment`, so the sample sorts.
- `await-placement` blocks `if`, loops, `switch`, conditional and logical expressions (`awaitBlockers` in `analyze.ts`). The syntax page says so.
- Self-review round 1: fixed seven imprecise claims and hardened the export check. Round 2 not needed.
