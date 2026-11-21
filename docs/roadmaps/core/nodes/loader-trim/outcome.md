# Outcome: loader-trim

## Built

Flag-off bytes removed from the todo loader, with no change in behavior. Source edits in `packages/idlip/src/client/`: `patch/patch.ts`, `patch/nodes.ts`, `patch/diff.ts`, `patch/index.ts`, `loader/resume.ts`, `list/index.ts`. `e2e/tests/todo.spec.ts`: `loaderBudget` is 3900.

| Change                                                                                              | Saved |
| --------------------------------------------------------------------------------------------------- | ----- |
| `getPlan` no longer filters `props` paths (a root model has no `props` field, so they never differ) | 18 B  |
| `enqueue` checks `unit === undefined` only under `HAS_CHILDREN`                                     | 11 B  |
| `createScope` sets `path` only under `HAS_CHILDREN`                                                 | 3 B   |
| `findNode` and `buildIndex` use `from` only under `HAS_CHILDREN`                                    | 19 B  |
| `signal` and `done` handling only under `HAS_SUBS` (3 sites in `resume.ts`)                         | 32 B  |
| `Reflect.apply` of bindings replaced by a typed call (`NodeBinding`, `ListBinding`)                 | 18 B  |
| `list/index.ts` uses `isElement` from `guards.ts`                                                   | 9 B   |
| `list/index.ts` uses `readField` from `diff.ts` instead of its own `getKey`                         | 16 B  |
| Total                                                                                               | 126 B |

## Proof

gzip -9 of the todo build loader (one file, no static imports):

- base (`batch/core` 6bd35c2): 4007 B.
- branch: 3881 B, under the 3900 B target. Sequence: 3989, 3978, 3975, 3956, 3924, 3906, 3897, 3881.

Cost of each flag when on, not re-measured here (the changes touch only flag-off code, and every flag still has its branch): `HAS_TASKS` +274 B, `HAS_KEYED` +124 B (`runtime-flags`), `HAS_CHILDREN` about +650 B (`nesting-runtime`). `HAS_REFS` and `HAS_SUBS` as in their outcomes.

## Deviations

- `listener.ts` `owner: m[3]` (about 12 B) stays. It sits in the inline listener, which no flag reaches, and the listener has its own budget.
- `Root.kind: 'root'` (about 8 B) stays. Nesting reads it and the type needs it.
- `Pending.unit` stays next to `root`. Dropping it would touch every use for a few bytes.
- `readField` is now exported from `patch/diff.ts` and `patch/index.ts` for the list code. It is not exported from `idlip/client`.
- `src/client/CLAUDE.md` still says 4096 B, the contract budget. The todo test now holds 3900 B.

## Stubs left

- None.

## Gotchas

- A `Reflect.apply` call of a `Binding` union costs about 9 B per call over a cast and a direct call.
- Spreading `...(HAS_X && { field })` folds away when the flag is off. A plain `field: value` does not.

## Proposed learnings

- Put a field that only one feature reads behind `...(HAS_X && { field })` | the plain field survives dead-code elimination | packages/idlip/src/client | no

## Verification

- `pnpm build` then the gzip measure: 3881 B.
- Full check: passed (see the final report).

## Size

- Estimated S, actual S.
