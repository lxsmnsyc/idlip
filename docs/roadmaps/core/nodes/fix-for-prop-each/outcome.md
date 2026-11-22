# Outcome: fix-for-prop-each

## Result

A row hole that reads component state updates when `each` is a prop.

## Cause

A list read from props has no state path, so the planner made no `l` binding for it. Row bindings in a state group were exported without their list, and the patcher could not reach the rows.

## Fix

`compiler/view/codegen/plan.ts`: such a list gets a pathless `l` binding when it holds row bindings; `planGroups` leaves pathless non-dynamic bindings out of groups. No client change.

## Tests

- `test/client/list/for-prop-each.test.ts` (failed before the fix).
- Differential subject `for-prop-each`.

## Verification

Build and tests 837 passed; tsc, website build and samples, e2e 27 passed, lint (warnings only), oxfmt clean. Loader unchanged (no client code touched), 3991 B.
