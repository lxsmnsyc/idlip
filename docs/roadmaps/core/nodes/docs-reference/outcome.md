# Outcome: docs-reference

## Built

- `website/docs/reference/`: `idlip.md`, `server.md`, `client.md`, `compiler.md`, `vite.md`, `jsx-runtime.md`, `testing.md` (one per subpath, section `Reference`, orders 100 to 106), and `syntax.md` (order 107): module and body rules, the hole grammar, attributes, events, `await` rules, children, and the diagnostics table.
- `website/docs/editor.md` (section `Tools`, order 90): `tsconfig.json` (`jsx: "preserve"`, `jsxImportSource: "idlip"`), plain TypeScript in the editor, where compiler diagnostics show.
- `website/scripts/reference/check-exports.ts`: reads `package.json` `exports` and lists the names of each built `types` file. It fails when an export has no h3 heading on its page whose text is the name in code, or when such a heading names no export. Run it with `node website/scripts/reference/check-exports.ts` after `pnpm --filter idlip build`.

## Deviations

- The editor page documents no extension, no `idlip-tsc` and no TypeScript plugin: none exists on `batch/core` (debate `debates/dsl` dropped them).
- The export check is a script only. It is not wired into a `package.json` script or a test, since `website/package.json` and `website/test/` are not owned paths. The orchestrator may add `"check:reference": "node scripts/reference/check-exports.ts"`.
- The diagnostics table adds rule ids that the compiler reports and `contracts/view-ir.md` v11 does not list: `attr-event`, `html-element`, `srcdoc-trusted`, `head-title-twice`, `try-catch-node`, `handler-props-unlisted`, `codegen-component`, `codegen-event`, `codegen-raw-text`, `codegen-unsupported`. It also lists `handler-derived-stale` as a warning, as the source does. The contract's summary line names only `let-unassigned` and `hole-impure` as warnings. No change request is written, since the contract is not wrong for this node. The curator may sync it.
- No files outside the owned paths and this node folder.

## Stubs left

- None.

## Gotchas

- `idlip` (`dist/index.d.ts`) does not export `JSX`. Pages import it from `idlip/jsx-runtime`.
- The check reads tsdown's output shape (`export declare ...` and `export { a, b as c }` lists). A bundler change that writes `export * from` would hide names from it.
- `mount(...).loaded()` order is not the click order: binding chunks can come first. Compare sorted lists.
- The view IR types on `compiler.md` are summarized, not copied in full. The page says the IR can change before `1.0`.

## Proposed learnings

- Keep the reference headings equal to the exports | the script fails on a missing or extra name | website/docs/reference | yes (`check-exports.ts`)

## Verification

- `pnpm --filter idlip build`, then `node website/scripts/reference/check-exports.ts`: 94 exports, 0 problems. With one heading renamed: 2 problems reported.
- `pnpm --filter website check:samples`: 15 samples, 0 problems.
- Self-review, one round with a fresh agent: no false claims, seven imprecise ones (event arrow `if` form, `submit` always prevents, `For` key literal and arrow body, `Try` catch form, `condition-operator`, `until` error, key filter wording) fixed. The export check now fails on a default export, a re-export or a `types` that is not a plain path, and reads `const enum`.
- `pnpm --filter website build`: 11 pages. `pnpm --filter website test`: 10 passed. `pnpm --filter website typecheck`: clean.
- Full check: `pnpm build`, `pnpm lint` (warnings only, none in `website/`), `pnpm format:check`, `pnpm typecheck`, `pnpm test` (659 passed), `pnpm --filter e2e test` (18 passed): all pass.

## Size

- Estimated M, actual M.
