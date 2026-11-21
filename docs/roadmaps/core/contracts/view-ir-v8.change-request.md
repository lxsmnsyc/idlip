# Change request: view-ir v7 to v8

- From: the user, 2026-11-21
- Status: accepted and applied to `contracts/view-ir.md`

## Problem

v7 makes `Math.random()` in a hole the error `hole-impure`. The reasons given for it do not hold in a resumable framework. There is no hydration check, so a server value that differs from a later client value is not a mismatch. Replay compares models, and a hole value never enters the model. A hole with no paths renders once on the server and never patches, which is consistent.

The one real case: a hole that mixes an impure call with state, such as `{count}: {Math.random()}`, computes a new value only when `count` changes. Patching relies on "same values at a hole's paths, same output", so the value changes on some updates and not on others.

## Proposed change

- Allow `Math.random`, `Date.now`, `performance.now` and `crypto.randomUUID` in holes, as `call` nodes with a `global` callee and `impure: true`.
- `hole-impure` becomes a warning, given only when the hole's path set is not empty. It names the paths that recompute the value.
- `handler-impure` stays an error.

## Affected nodes

`compile-view-analyze` (emits the flag and the warning), `compile-view-codegen` (emits the call as is).
