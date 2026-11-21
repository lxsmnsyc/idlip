# Log: run-tasks

- Built `runTask(host, task)` in `src/client/tasks/run.ts`. One call site in `resume.ts` (`apply`), so a flag can wrap it.
- Size on the todo example build, gzip -9, same method on both sides: base 4099 B, with tasks 4330 B (+231 B). Orchestrator said not to fight it: `runtime-flags` puts the runner behind `HAS_TASKS`.
- Tried and kept: `chunk.run ?? chunk['task$<site>']`, `target: root.script` for the queued continuation (no element). Tried and dropped: `.then` outcome chain (+10 B), `isCustom` helper.
- Handlers receive the payload array as one argument: `update(model, p)`.
