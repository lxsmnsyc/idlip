# Log: event-callbacks

## Design notes

- Read brumate first (`markup.md` "Events", "Before the handler loads", `runtime/loader.ts`). Brumate runs the handler after the dispatch and passes the event. What must happen during dispatch is written in the markup (`prevent(handler, ...keys)`), and the loader applies it. idlip does the same with the compiler: leading statements of the arrow become modifiers.
- The row problem: a function in a handler chunk cannot see the row. Rows carry no key in the DOM, and `getRows$` (already used for `<Try>` resets) reads the rows around an element from the markers, with the list paths. The event function calls it with the model the DOM shows (`rendered`). First try: the current model. That is wrong when an earlier event of the same batch removes a row above the clicked one, so rows come from `rendered` and everything else from `model`.
- Message props of a stateful child stay data (`["remove",["a1"],"",""]` in the props of the child). They are built in the parent's render and travel in the state script, so they cannot be functions, and a child's function could not read the parent's rows. They cannot read the event any more (`event-message-event`).
- Where the function lives: the handler chunk of the first handler the arrow calls. The first click of the todo still loads the handler chunk and the binding chunk only (e2e passes). Other handlers of the arrow go into `listens`, so the server preloads them. The loader does not preload them (cost: 50 B gzip on the loader). A second handler of the arrow loads after the function runs.
- Merging site code into a handler chunk: the view codegen prints the function with its own imports, and `compile()` appends it (`sites.ts`). Same-named module helpers and imports are not repeated.
- The loader budget: first version 4173 B (e2e method), over 4096 B. Removed the preload of the other tags, merged the two lookups (`getUpdate` takes the manifest table) and passed the unit as the function scope. Now 4086 B.

## Steps

1. `7e751a3` change requests.
2. `4e86caf` compiler, listener and loader together. The attribute format changes, so a loader that reads the old one and a compiler that writes the new one cannot land apart and keep the differential test green. The goldens and tests moved with it.
3. `b741636` docs.

## Findings

- Two tests of `test/client/global/build.test.ts` failed in my first full run, before I had changed the compiler for them, and passed in the later full runs. I did not find the cause.
- `latest` and queued `input` events: the old test `keeps every queued input` expected `a,ab,`. The function reads the field when it runs, so it is `ab,ab,`. Behavior change, in the change request.
- The dashboard state script grows 7.5 kB raw (state gzip 4828 to 4913 B, +85 B): the props that handlers read are now in the state, since the functions read them at event time, where before each event attribute repeated the values.
- Handler chunks now import the helpers module for `getRows$`. The helpers module gets `getRows$` in any app with an event in a row (+525 B raw on the todo).

## Review fixes

- `getRows$` stops at the `<!--n:...-->` marker of the component (a sibling `<!--/n-->` ... `<!--n:-->` pair is skipped), so a child's list is not matched with the lists of its parent. Test: a child with a `<For>` inside a parent `<For>`.
- `manifest.sites` is gone: a function is a `handlers` entry with `tags`. `getUpdate` lost its table parameter, and the loader starts each tag's chunk with the function's chunk and loads all updates before running the first message. Loader 4087 B.
