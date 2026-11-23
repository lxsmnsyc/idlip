# Log: server-only-code

- Measured: `import.meta.env` inside a handler or a derived const is a compile error (`hole-grammar`, `handler-free`). It reaches a chunk only through a module-level binding of the component (copied into the chunk) or through an imported module. Tests cover both.
- Measured: the compiler copies into a chunk only the imports and module-level bindings that its code uses, so scanning the chunk code is enough to leave server-render-only imports unchecked.
- Design: the check lives in the `load` of a chunk id (client environment only), so a build and `vite dev` share it. It parses the chunk code and each walked file with `oxc-parser`, resolves specifiers with `this.resolve`, and reads sources from disk. A scan cache is kept by file and source text.
- The walk skips `idlip` and `idlip/*` by name, files under `node_modules`, virtual ids and non-scripts, so the runtime of idlip and dependencies give no false positives.
- Vite's resolved config keeps `envPrefix` as given (undefined by default), so the default `VITE_` is applied by the plugin.
