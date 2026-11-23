# Change request: compiled-format, shared helpers module

From node `shared-helpers`. Applied locally on `node/shared-helpers`.

## What changes

1. **Budgets** (line "The DOM and render helpers ... are not in the loader: the compiler copies the ones a chunk uses into that chunk"). Replace with: the DOM and render helpers are not in the loader and not copied. A client chunk imports the ones it uses from `idlip/helpers`, a module the Vite plugin writes from the helper sources (`printHelpersModule()` in `core/helpers.ts`, exported by `idlip/compiler`). The bundler keeps the helpers the chunks use in one file. `idlip/helpers` imports only from `idlip/client`. A chunk may import from `idlip/client` only what the loader holds, and from `idlip/helpers`.
2. **Chunk URL map.** A second extra key, `helpers`, holds the URL of the built helpers file. Unlike `build`, `render()` keeps it in the state's `chunks`. It is absent in dev, and when no chunk imports a helper or one chunk alone does (the bundler inlines the module into that chunk).
3. **Loader.** On an event, the loader loads `chunks.helpers` (when present) with the handler chunk and the binding chunks of the write set, so the first click stays one round trip: 3 requests in parallel instead of 2 for the todo toggle.
4. **Nesting, adding.** A template chunk imports the child's view by name, `import { init as $init_<Name>, render as $render_<Name> } from '<module>?idlip-view&lang.js'`, and passes `{ init, render }` to `addChild`. A namespace import made the bundler emit each view twice.
5. The example chunk under "Binding chunks" (`import { setAttr, setText } from 'idlip/client'`) becomes `import { setAttr$, setText$ } from 'idlip/helpers'`.

## Why

Copies put the same helpers in every chunk. Dashboard client dist: 150.4 kB gzip with copies, 104.0 kB with the shared module (-31%). The helpers in the loader measured 4681 B gzip on the todo loader, over the 4096 B budget, and the todo app uses every one, so no flag could drop them. The loader change costs 28 B gzip (4035 to 4063 B).

## Cost

A first click fetches the whole helpers module of the app: todo toggle 613 to 1.2 kB gzip, dashboard widget 1 983 B to 1.4 kB. Later first clicks fetch less (dashboard widget 30 after widget 1: 953 to 699 B). The total after 3 dashboard widgets is equal (7.4 kB gzip both), and lower after more.
