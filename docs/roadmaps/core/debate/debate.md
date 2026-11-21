---
goal: Pick idlip's surface language so the todo app resumes with one handler chunk plus changed binding chunks, at the lowest total cost
date: 2026-11-20
rounds: 3 of 3 (round 3 added nothing)
status: approved
roadmap: docs/roadmaps/core
supersedes: none
decision: none
---

# Debate: idlip's surface language

Options weighed: (A) TS subset with restricted JSX in `*.idlip.tsx`, (B) an own Elm-like language with its own type checker, (C) a custom syntax for view and update compiled to typed TS, (D) brumate's markup syntax without its `<script>` and `<style>` blocks.

## Settled structure

1. Fix a closed grammar for holes, attribute values and event payloads before any surface syntax. Allowed: model and loop-variable paths, literals, comparison and boolean operators, ternary, template strings, helper calls. No closures, assignments or statements. Every surface syntax parses into the same view IR, so the view IR is the only seam between syntax and compiler. (P1, O7)
2. Helper rule: the callee is an import or a module-level function, and every argument is in the closed grammar. A closure argument is a compile error. A hole's paths are the union of its argument paths. A whole-model argument is a compile error, not a warning as in 0001. A helper whose body is one return expression in the closed grammar is inlined, for exact paths. (P6, O9)
3. Ship option A for the proof of concept (`todo-resumes`): `*.idlip.tsx`, one `defineModule` default export, oxc enforcing the grammar, plain TS model, messages and update. No new parser, language server or editor extension. (P2, O7)
4. Update handlers stay TS in every option. `write-sets`, `update-ops` and `keyed-paths` are the analysis for them, unchanged. (P5)
5. Stale bindings from hidden helper dependencies are caught in `testing-mount`: after each message, re-render the view on the server and compare it with the patched DOM. No dev-mode chunk loading. (O8, O9)
6. Conditions are plain JSX: `cond ? <A /> : <B />` and `cond && <A />` are condition blocks, and chains replace a switch. `<Show>`, `<Switch>` and `<Match>` are dropped. `<For each key>` stays for now. (user, 2026-11-20)
7. After the proof of concept, a markup DSL with real control-flow blocks replaces the TSX view syntax: outline node `markup-frontend` (should, `apps`, after `example-todo`). It parses into the same view IR. It keeps no `<script>` or `<style>` blocks; styles are an imported sidecar. Diagnostics carry rule ids. (P3 and P7, user overrule of O11)

## Roadmap changes

- `contracts/view-ir.md`: add the closed-grammar list, the helper rule and `helper: 'args' | 'inlined'`. (P6, P9)
- `spike-view-analysis`: acceptance covers the closed grammar and helper inlining, before view IR freezes at the contract gate. (O12)
- `compile-view-analyze`: report grammar violations as errors with rule ids. (P9, O11)
- `testing-mount`: add the server re-render versus patched DOM check. (O9, O12)
- New outline node `markup-frontend`, after `example-todo`. (user overrule)
- 0001 View rules: conditions are JSX ternaries and `&&`; helpers are imports or module-level functions, and a closure or whole-model argument is an error. (user, O9)
- `jsx-types`, `patch-bindings`: no `<Show>`, `<Switch>` or `<Match>`. (user)
- `core-api.md`, 0002, `compile-update`, `write-sets`, `update-ops`, `keyed-paths`, `dynamic-paths`: unchanged.
- Net: 0 new must nodes. The must line stays at wave 6.

## Budget

- device: no change. 8 GB RAM, 8 cores, 15 GiB free; no second toolchain. (J1)
- time: no new must work. D costs about 4.3k lines of parser and analyzer plus 2 weeks of type and editor tooling, paid only when the O11 trigger fires. (J4, O1)
- tokens: agents keep working in TSX, which models know well. No grammar file in every prompt. (O4)

## Rejected

- B, own language and type checker: HM inference, error messages and editor tooling took Elm years, and idlip would lose npm types and oxc. (A2, J7)
- C, view and update in a separate custom file: breaks the single `defineModule` export and `msg` inference. (O3)
- D before the proof of concept: brumate needed a 1140-line parser and a 3208-line analyzer beyond the tooling route, and block syntax carries the same facts as `<For key>` and `<Show when>`, so it cuts no node. (P3; O1, O2)
- D with a `view(m)` header in place of `<script>`: same `defineModule` break. (P4, conceded in P7 on O3)
- A tsc language-service plugin for grammar diagnostics: duplicates the compiler's diagnostics from the Vite plugin. (A1; O6)
- Dev-mode re-evaluation of patched holes: circular, since stale holes are the unpatched ones. (P6 part; O8)
- Token-count trigger for D: not measurable as stated. (P8; O10)

## Proofs

- None. No open claim needed one.

## Prior art

- brumate: custom `.brm` syntax built in one month. TS checks and editor support via Volar and a `toTypeScript()` emitter took about 65 commits and 2 weeks. Its holes still hold arbitrary TS expressions. (J4, J5, O1)
- Elm, ReScript, Gleam/Lustre: own languages pay for type checkers and FFI. Svelte, Vue, Marko: custom templates with TS through generated code are the adopted path. (J7)

## Open risks

- The DSL makes view files invalid TS: tsc, oxlint and oxfmt stop reading them. Accepted by the user; tooling follows brumate's route. (O1, J4)
- Helper purity is not checked. A hidden dependency leaves a binding stale. Mitigated by the `testing-mount` check, not prevented. (O5, O9)

## Inferred choices

- MVU concept, TS naming, oxc parser, `*.idlip.tsx` modules stay. (J6): from `GOAL.md` Constraints and 0002. The debate keeps them.

## Answers from the user

- Should brumate's markup design be weighed? Yes, minus the `<script>` and `<style>` blocks. (Q1)
- Stick to TS for now while working on the proof of concept, and keep `<For>` for now. (2026-11-20)

## Overruled

- P3: the judge rejected a markup frontend after 0.1. The user upholds it: they want real control-flow blocks, because JSX needs fake control-flow components. It comes after the TSX proof of concept. Source: the user, 2026-11-20, objecting to repeated pushback for plain TS: "we never had this kind of pushback with brumate". They accept the brumate-style tooling (Volar language core, tsc wrapper, editor extension). Settled: do not reopen TS versus DSL unless the user asks.
- O11: the judge set a trigger of 10 block-removable diagnostics. The user rejects the trigger: the debate weighed syntax only by node count, not by authoring value.

## Cost of this debate

- 3 of 3 rounds, about 184k tokens
