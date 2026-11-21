# Change request: view-ir v8 to v9

- From node: compiled-format
- Status: open

## Problem

view-ir v8 reserves `modifiers` on `Event` and emits none, "until `jsx-types` fixes the syntax". The brief of `compiled-format` asks for a todo fixture with a form submit with `prevent` and an input with a key filter, so the fixture source needs a syntax now, and the analysis must accept it. The syntax must not be a compile-time API.

Encoding the format also needs three rules the v8 list lacks: author attributes that use the reserved `i-` prefix, event arguments that use the event other than as a whole path, and holes in raw text elements.

## Proposed change

1. An event arrow may have a block body that reads as plain TypeScript and means the same when run (`packages/idlip/test/fixtures/todo/todo.idlip.tsx` uses both forms):

   ```tsx
   <form on:submit={(e) => { e.preventDefault(); add(); }}>
   <input on:keydown={(e) => { if (e.key === 'Escape') { clear(); } }} />
   ```

   - Leading `e.preventDefault();` and `e.stopPropagation();` statements, then one handler call, give `{ kind: 'prevent' }` and `{ kind: 'stop' }`.
   - `if (<test>) <call>`, or `if (<test>) { <prevent or stop statements> <call> }`, gives `{ kind: 'key', filter }`. The test is `e.key === '<key>'`, joined with `&&` to any of `e.ctrlKey`, `e.altKey`, `e.shiftKey`, `e.metaKey`, in any order. The filter is written `Ctrl+Alt+Shift+Meta+<key>` with only the named keys, such as `Escape` or `Ctrl+s`.
   - Prevent or stop statements before an `if`, an `else`, or any other statement stay `event-closure`.
   - `once`, `capture` and `passive` have no source form in v9.

2. New rule ids, all errors:

   | Rule id                 | Case                                                                                                                                          |
   | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
   | `attr-reserved`         | An author attribute whose name starts with `i-`.                                                                                              |
   | `event-placeholder`     | An event argument that reads the event parameter other than as a whole path (`e.currentTarget.value.trim()`, `{ v: e.currentTarget.value }`). |
   | `html-raw-text`         | A hole in `<script>` or `<style>`, or a hole in `<textarea>` or `<title>` next to other content.                                              |
   | `event-passive-prevent` | An event with both `passive` and `prevent`. No source form gives `passive` in v9, so the rule waits for one.                                  |

3. `html-nesting` also covers a text hole directly in `<table>`, `<thead>`, `<tbody>`, `<tfoot>` or `<tr>`, and checks across block boundaries: a `<For>` or condition inside a table part whose body is text.

## Affected nodes

`compile-view-analyze` (emits modifiers and the new rules), `compile-view-codegen` (encodes modifiers), `jsx-types` (the block body must type-check, which `EventProp` already allows), `resume-loader` (applies modifiers).

## Workaround in place

The todo fixture source uses the forms above. The fixture's expected output encodes them as `on:submit='["add",[],"prevent"]'` and `on:keydown='["clear",[],"key:Escape"]'`. The fixture test does not run the analysis, so nothing else depends on this change yet.

## Decision
