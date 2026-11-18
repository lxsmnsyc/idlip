# Premortem

It is some weeks from now. The `todo-resumes` milestone shipped late or not at all. Why?

1. **The golden fixtures encoded a format the compiler cannot produce.** `compiled-format` was hand-written before `spike-view-analysis` finished, so the binding groups in the fixture do not match the path sets the analysis can compute.
   - Change: `compiled-format` reads the spike outcome before freezing. Both are in the contract gate, and the user reviews them together.

2. **Rolldown merged the tiny chunks.** The plugin emitted one chunk per handler, but the bundler inlined or merged them, so the first click loaded the whole update.
   - Change: `spike-chunk-split` must report the chunk count for the todo fixture after `vite build`. The e2e test counts network requests, so a merge fails the milestone check.

3. **List item paths were too coarse.** Toggling one todo reported `todos` as changed, so every list binding reloaded and the chunk count missed the target.
   - Change: `patch-bindings` property test checks the changed-path set exactly, including `todos.*.done` granularity. `patch-lists` patches only changed item fields.

4. **Resume broke on events that arrive before the loader.** A click during page load was lost.
   - Change: `resume-loader` acceptance covers queued events. `e2e-harness` adds a test that clicks before scripts finish loading.

5. **The view rules were too strict to write the todo app.** `example-todo` needed a helper or alias that the analysis rejects, and the compiler work restarted.
   - Change: `spike-view-analysis` analyzes the full todo view from the proposal, including `visible(m.todos, m.filter)`. Accept the remaining risk: `example-todo` may file a contract change request on `view-ir`.
