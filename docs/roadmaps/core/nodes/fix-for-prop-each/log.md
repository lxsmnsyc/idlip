# Log: fix-for-prop-each

- Repro: `test/client/list/for-prop-each.test.ts` and the differential subject `for-prop-each` failed with `attribute data-r is "2" in the page and "4" in the server render`.
- Cause is in the compiler. `<For each={props.items}>` has no state path, so `bindHole` gave the list no `l` binding. The row bindings (`a1`, `t3`) sat in group `big`, but `addListExports` found no `l0` to export, so the patcher never reached the rows.
- Fix in `plan.ts`: after walking a list body, a list with no binding but with row bindings (or a nested list with some) gets an `l` binding with no paths. `planGroups` skips it, so it adds no group and rides in the chunks of its row bindings.
