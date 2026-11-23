# idlip

## 0.1.0

### Minor Changes

- 1bb7420: A package can publish idlip components as source. Mark it with `"idlip": { "version": 1, "dir": "src" }` in its `package.json`, and an app that lists the package in `dependencies` or `devDependencies` gets its `.tsx` files compiled by the plugin, in `vite dev` and in a build, with their stylesheets linked. A field with another `version` stops `vite` at startup.
- 311379d: Stylesheets that components import now reach the page. `import './todo.css'` and CSS Modules (`import styles from './todo.module.css'`) work in a build and in `vite dev`: the server links every stylesheet that the root component's imports reach in `<head>`, before the preload links, with the nonce. `csp: true` adds `style-src 'self'` and the nonce. `RenderResult` has a new `styles` field.
- 6898626: First release: a resumable MVU framework. Components are TSX function components, the server renders the page with its state, and the browser loads only the code of the handler a user triggers.
- 487d030: The build fails when code that only a server can run reaches a client chunk. A handler, binding, list or view chunk whose imports reach a `node:` module or a bare Node.js built-in fails, and so does one that reads an `import.meta.env` key without the `envPrefix` (`VITE_` by default). The error names the chain from the component to the cause. `vite dev` runs the same checks when a chunk is first requested.

### Patch Changes

- 5c6a818: A function assigned to a `let`, as its initial value or inside a handler, is the compile error `let-function`, which says to use a function declaration.
- aed9cf6: A `style` attribute given an object renders as CSS text instead of `[object Object]`. Keys that start with `--` are written as given, other keys go from camelCase to kebab-case, `null`, `undefined` and `false` values are dropped, and numbers get no unit. A static object folds at compile time.
