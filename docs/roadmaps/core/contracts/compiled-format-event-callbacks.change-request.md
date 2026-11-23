# Change request: compiled-format, event callbacks

From: `event-callbacks`. Target: Events, Modifiers, Delegated listening, the manifest and the loader's queue in `contracts/compiled-format.md`.

Status: proposed. Implemented on `node/event-callbacks`.

## Problem

An event attribute carried data: the handler tag, a JSON payload with literals, values computed at render (row keys) and `["$event", ...path]` reads. So an arrow could hold one handler call, its arguments had fixed field names (`event-computed-key`), and every row repeated a payload in the HTML.

## Proposed change

1. **Attribute.** An `on:<event>` attribute is `<site>[ <modifier>...]`: the name of an event function, then the modifiers, separated by spaces.

   ```text
   on:click="$e3"
   on:submit="$e0 prevent"
   on:keydown="$e2 key:Escape"
   on:keydown="$e5 prevent:ArrowDown prevent:ArrowUp"
   ```

   The site name is `$e<n>`. Sites count on their own counter in source order, per component. Nothing binds an event arrow: it has no `a<id>`, no `i-a` entry and no `setOn$` write. The template holds the attribute as plain text.

2. **JSON form stays for data built at render.** A value that starts with `[` is a `DomMessage`, as before, without placeholders. It is used for a message prop that a stateful child receives (`onRemove={() => remove(t.id)}` in the parent), a forwarded message prop in the child (`on:click={props.onRemove}`) and a `<Try>` reset (`["$reset",[<region>]]`). The `["$event", ...]` and `["$", ...]` placeholders are removed. A message prop arrow cannot read the event (`event-message-event`).

3. **Event function.** A site is an export of the handler chunk of the first handler it can send:

   ```js
   export function $e3($e, $c, { model, rendered, page: { props } }) {
     const rows = getRows$($c, rendered, $e3_lists);
     return [['toggle', [rows[0].item.id]]];
   }
   ```

   - `$e` is the DOM event, or the value of a `<Subscribe>`. `$c` is the element that holds the attribute (`window` or `document` for a global event). The browser clears `currentTarget` after dispatch, so the listener records it and `e.currentTarget` in the source prints as `$c`.
   - It returns the messages the event sends, as `[tag, payload]` pairs, in order. The update still receives plain data: the log, replay, devtools, `mount` tests and the state script do not change shape.
   - `model` is the current model of the component. `rendered` is the model the DOM shows. Row values come from `rendered` through `getRows$` (the helper that already reads the rows of a `<Try>` reset): the row the user clicked, even when earlier events of the same batch removed or moved rows. The list sources are `lists$`: a model path, or a function of the scope for an `each` that is not a path.
   - Props come from `page.props` of the unit that owns the element.

4. **Manifest.** `Manifest.sites?: Record<string, SiteEntry>` with `SiteEntry = { chunk: string; bindings?: string[]; tags: string[] }`. `chunk` is the chunk of the first tag. `bindings` is the union of the `bindings` of the tags, absent when one tag has none. `tags` lists every handler the event may send. `listens` lists all of them too, so the server preloads each chunk.

5. **Queue.** `QueuedEvent` is `QueuedMessage | QueuedCall`. A message has `message`. A call has `site`, `event` and `current`, and no `message`. A call has the same `target`, `type`, `latest`, `owner`, `done` and `signal`. The loader loads `manifest.sites[site].chunk` with the bindings of the site and runs the function when the event reaches its turn in the batch. Each message that it returns then runs through `update` in order. A function that throws is reported like a handler that throws.

6. **Modifiers.** New: `prevent:<filter>`, one token per key filter, with the grammar of `key:<filter>`. The listener calls `preventDefault()` when the event matches one of them and the event is not passive. The event still reaches the loader for every key. `key:<filter>` is unchanged: it drops the event before it is queued.

7. **Source forms.** An event arrow holds, in this order:
   - leading `e.preventDefault();` and `e.stopPropagation();` statements, which give `prevent` and `stop`;
   - leading conditional prevents, `if (<key test>) e.preventDefault();`, where the test is `e.key === '<key>'` joined with `&&` to `e.ctrlKey`, `e.altKey`, `e.shiftKey`, `e.metaKey`, and with `||` between alternatives. They give one `prevent:<filter>` token per alternative. They need no import and no marker: the same code means the same thing when run in a browser, and the compiler lifts it to the listener because the event has dispatched by the time a handler can run;
   - then handler calls, `if` and `else` on any expression of the view grammar, and `const` declarations of one expression. Nothing else.
   A sole `if (<key test>) { ... }` with no `else` still gives `key:<filter>` and drops the event before it is queued. The arrow may call any number of handlers, or none in some branches. An arrow with no call at all is `event-no-call`.

8. **Errors.** Removed: `event-computed-key`, and `event-closure` for an arrow of more than one call. New: `event-statement` (a loop, a `return`, a `let`), `event-no-call`, `event-prevent-twice` (a conditional prevent after an unconditional one), `event-message-body` and `event-message-event` (a message prop of a child), `event-target-nested` (a message prop or reset that is not the only call). `event-placeholder` now means passing the whole event as an argument, which is not plain data. `await` in an arrow is `event-closure`: the arrow runs after dispatch.

## Behavior change

An event function reads the DOM when it runs, not when the event fires. Two `input` events queued while a chunk loads both read the value of the field at that time. The model ends the same, since the last event wins. `contracts/compiled-format.md` says "Queued `input` events keep the value each one had": that sentence is removed. The modifiers still apply at dispatch.

## Affected nodes

`global-events`, `form-fields`, `nesting`, `shared-templates`, `document-head`, `devtools`.

## Workaround in place

Implemented in `src/compiler/view/codegen/{events,plan,chunks,html,template}.ts`, `src/compiler/sites.ts`, `src/client/loader/{listener,resume}.ts` and `src/client/subs/index.ts`.

## Decision
