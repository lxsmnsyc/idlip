# Log: compile-view-codegen

- Reset to batch/core, renamed branch to feat/compile-view-codegen.
- Built plan (ids, groups, covers), expression printer, html builder (server and client), events, module helper copy, chunks, manifest.
- The todo fixture needs v9 arrows, which the analysis cannot read yet. The test analyzes a variant with plain handler references and sets the `prevent` and `key` modifiers on the IR by hand.
- Orchestrator notes applied: props values come first in the payload (compiled-format v9), props paths follow the `listHandlerProps` order, a method name at the end of a props path is dropped.
- Rebased on batch/core after the v9 contract landed. Fixtures still match.
