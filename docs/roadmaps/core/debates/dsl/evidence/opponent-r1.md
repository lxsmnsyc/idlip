# Opponent round 1 evidence

## O1: update emit is tied to TS handler bodies

```
     517 packages/idlip/src/compiler/update/emit.ts
    1027 packages/idlip/src/compiler/update/handlers.ts
       2 packages/idlip/src/compiler/update/index.ts
     388 packages/idlip/src/compiler/update/segments.ts
     131 packages/idlip/src/compiler/update/tasks.ts
     337 packages/idlip/src/compiler/update/writes.ts
    2402 total
packages/idlip/src/compiler/update/tasks.ts:1:import type { Node as AstNode, CallExpression } from '@oxc-project/types';
packages/idlip/src/compiler/update/tasks.ts:2:import { listChildren } from './emit.ts';
packages/idlip/src/compiler/update/segments.ts:3:import type { Node as AstNode, CallExpression } from '@oxc-project/types';
packages/idlip/src/compiler/update/segments.ts:4:import { emitRange, getPropsVariable, listChildren } from './emit.ts';
packages/idlip/src/compiler/update/segments.ts:5:import type { EmitOptions } from './emit.ts';
packages/idlip/src/compiler/update/emit.ts:3:import type { Node as AstNode } from '@oxc-project/types';
packages/idlip/src/compiler/update/segments.ts:89:export function findAwaitSites(body: readonly AstNode[]): {
packages/idlip/src/compiler/update/segments.ts:361:export function splitSegments(input: SplitInput): Split {
packages/idlip/src/compiler/update/emit.ts:32:export function getPropsVariable(path: string): string {
packages/idlip/src/compiler/update/emit.ts:43:export function listChildren(node: AstNode): AstNode[] {
packages/idlip/src/compiler/update/emit.ts:308:export function emitRange(
packages/idlip/src/compiler/update/emit.ts:358:export function listPatternNames(pattern: AstNode, into: string[]): void {
packages/idlip/src/compiler/update/emit.ts:502:export function scanReferences(node: AstNode, locals: readonly string[] = []): Reference[] {
packages/idlip/src/compiler/update/emit.ts:509:export function listReferences(
```

P1 sketch update arms that are not TypeScript: `SetDraft(text) -> { draft = text }`, `Add -> draft === '' ? {} : { todos = ..., next = next + 1 }`, `Toggle(id) -> { todos[t => t.id === id].done = !it }`.

## O2: rules in P3's 33 that police semantics A keeps (analyze.ts messages)

```
handler-mutate: 2858-            `${name} changes ${root.name} in place; assign a new value instead`,
handler-assign: 2847-            `${name} assigns ${target.name}, which is not a state field or a local`,
init-scope: 2526-          why: 'An initial value reads props, imports and module constants only',
let-init: 805-              `${object.name}.${names[0]}() in an initial value differs between server and client; set the field in a handler`,
let-unassigned: 2609-          `The state field ${field.name} is never assigned; make it a const`,
helper-closure: 923-          'A closure argument to a helper is not allowed',
hole-closure: 452:        return this.reportError('hole-closure', 'A closure is not allowed in a hole', node);
hole-function-value: 525-            `The function ${name} is used as a value; call it or move it to a handler`,
event-placeholder: 1238-          `An argument reads ${param.name} only as a whole path such as ${param.name}.currentTarget.value`,
for-param: 2152-            'A <For> item pattern takes plain fields only, without defaults or rest',
for-each: 2084: '<For> needs each' (#for still needs a source and `by`)
try-catch: 1990: '<Try> takes catch=...' (#try still needs a catch branch; v1 had markup-catch)
props-whole: 580-            'A stateless component must read props by name, not pass the props object along',
```

13 of the 33. P1's own sketch reads `event.currentTarget.value` (event-placeholder) and writes `todos[...].done = !it` (handler-mutate decides whether that is allowed).

v1 markup parser rule ids (new grammar adds its own):

```
'markup-attribute' 'markup-catch' 'markup-element' 'markup-expression' 'markup-for-key' 'markup-header' 'markup-orphan' 'markup-position' 'markup-reserved' 'markup-switch-child' 'markup-tag-mismatch' 'markup-unclosed'
```

## O3: calibrated cost of the front end that A rewrites (docs/roadmaps/CALIBRATION.md)

```
 spike-view-analysis   351,763
 compile-view-analyze  314,743
 compile-update        264,692
 analyze-v9            173,608
 props-method-path     132,199
 keyed-paths           166,682
 custom-effects        261,751
 run-tasks             206,720
 errors                241,160
 form-fields           161,054
 document-head         286,357
 svg-and-html          244,570
 safe-urls-2           83,522
 dynamic-paths         363,165
```

Base (first five): 1,237,005. Feature nodes that added front-end rules (last nine): 2,016,000 (rounded). P4 prices parser+view+update+effects at 1.2M.
git log of analyze.ts / update/: dynamic paths, URL gaps, SVG+MathML, form fields, refs, keyed paths, props method path, view-ir v9, async split, write sets, nested components.

v1 did not rewrite the front end: 0005-markup.md (feat/markup-frontend): 'The compiler lowers to TSX and runs analyze() unchanged.'

## O4: v1 tooling and parser

```
     145 packages/language-core/src/index.ts
      54 packages/tsc/src/index.ts
      38 packages/language-server/src/index.ts
      51 packages/language-server/src/diagnostics.ts
      27 packages/vscode/src/extension.ts
     415 packages/idlip/src/compiler/markup/lower.ts
    1167 packages/idlip/src/compiler/markup/parse.ts
9:import { toTypeScript } from 'idlip/compiler';
62:  const { code, segments, diagnostics } = toTypeScript(source);
873:function findMarkupAfterReturn(source: string, end: number): MarkupStart | null {
898:function findFunctionBody(source: string, afterKeyword: number): FunctionHead | null {
962:function scanFunctionBody(
982:function scanBodyFrom(
1044:function finishFunction(
1103:export function parse(source: string): ParseResult {
1128:function scanTopLevel(source: string, from: number, functions: MarkupFunction[]): number {
```

brumate toTypeScript lowering: packages/brumate/src/check.ts 1295 lines, 31 commits; language-core imports toTypeScript from 'brumate'. The 440 lines of P6 are the plumbing only.
markup-example outcome (v1): 'Both examples build to the same chunk names ... so the e2e tests pass unchanged' — same analyze() on lowered TSX.

## O5: effects were decided against commands

```
7c3300a 2026-11-20 22:58:58 +0800 docs: declare messages first and pass constructors to commands
e76fce8 2026-11-21 09:51:22 +0800 docs: make function components the module form, with no compile-time API
- **Effects are `await` in a handler.** The compiler splits an async handler at each `await` into a task and a continuation. This replaces `task()`, `Result<T>` and commands that take constructors. Errors go to `try` and `catch`.
```

0002 line 130: continuation tag persist$1; client/tasks/run.ts runs tasks and continuations.

## O6: dependency chain to release-0-1

```
markup-v2 <- markup-syntax-v2
markup-port <- markup-v2
markup-only <- markup-port
markup-ts-plugin <- markup-only markup-frontend
website-scaffold <- markup-only markup-frontend
docs-start <- website-scaffold markup-frontend
docs-reference <- website-scaffold markup-frontend markup-ts-plugin
website <- website-scaffold docs-start docs-effects docs-nesting docs-platform docs-reference docs-benchmarks
release-0-1 <- markup-ts-plugin markup-frontend website
```

## O7/O8: node status

```
markup-frontend status: active size: XL
markup-syntax-v2 status: active size: M
markup-v2 status: todo size: L
markup-port status: todo size: L
markup-only status: todo size: M
markup-ts-plugin status: todo size: M
```

markup-v2 goal: 'the lowering builds the internal TS module the analyzer reads (props from Props, no user-written wrapper)' = the current structure in a markup-first file, excluded by J11.
Calibration ranges: S 83k-174k, M 145k-365k, L 244k-463k (CALIBRATION.md).
Package: packages/idlip/package.json version "version": "0.0.0-stage",
