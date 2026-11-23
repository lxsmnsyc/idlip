---
'idlip': minor
---

The build fails when code that only a server can run reaches a client chunk. A handler, binding, list or view chunk whose imports reach a `node:` module or a bare Node.js built-in fails, and so does one that reads an `import.meta.env` key without the `envPrefix` (`VITE_` by default). The error names the chain from the component to the cause. `vite dev` runs the same checks when a chunk is first requested.
