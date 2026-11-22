---
title: idlip/vite
order: 104
section: Reference
description: The Vite plugin that compiles *.tsx modules, emits their chunks and serves pages in vite dev.
---

`idlip/vite` is the build integration. It compiles `*.tsx` modules, emits one client chunk per handler, binding group and list, gives the server module the chunk URLs, and serves server-rendered pages in `vite dev`.

```ts
import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' })],
});
```

`vite build` builds the client environment (the loader and the chunks) and the ssr environment (the server entry). The plugin checks that no chunk imports a shared chunk, so a click loads only the chunks it needs.

## Plugin

### `idlip`

```ts
function idlip(options?: IdlipOptions): Plugin[];
```

Returns the plugins to add to `plugins` in the Vite config. Modules that another module renders as children are found by import and compiled with `child: true`.

### `IdlipOptions`

```ts
interface IdlipOptions {
  modules?: string | readonly string[];
  entry?: string;
  client?: string;
  compile?: (source: string, id: string, options?: CompileOptions) => CompileResult;
  skew?: boolean;
}
```

| Option    | Default                       | Meaning                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules` | `src/**/*.tsx`                | Globs of the idlip modules, relative to the root. The plugin compiles a matched file only when it declares a function component. A `.tsx` file with none, such as an entry, and a file that no glob matches go to Vite as plain TSX. A component in a file outside the globs gives a warning, and rendering one as a child is a build error. Both name this option. |
| `entry`   | none                          | The server entry that `vite dev` renders pages with, such as `/src/entry-server.ts`. It exports `render(url)`, which returns the page HTML. It is also the input of the ssr build when the config sets none.                                                                                                                                                        |
| `client`  | `idlip/client`                | The input of the client build: the loader. Every module an idlip chunk imports must be in its static graph.                                                                                                                                                                                                                                                         |
| `compile` | `compile` of `idlip/compiler` | The compiler to run.                                                                                                                                                                                                                                                                                                                                                |
| `skew`    | on in a production build      | Recover when a page cached from an older build meets this one.                                                                                                                                                                                                                                                                                                      |

With `skew`, pages carry a build id, the client build keeps the files of the previous build, and the loader reloads once when a chunk fails and the server runs another build. The client build writes `build.js` next to the loader. Serve it with `Cache-Control: no-store` or a short max age: the loader imports it to learn which build the server runs, and a cached copy hides a new deploy.

Retention reads `<build.outDir>/.idlip/builds.json`, so keep `build.outDir` between deploys, or restore the previous build before building. On a clean checkout the build keeps nothing, and a page cached from the last deploy finds its chunks gone and reloads. Only files of the build are deleted, never files from `publicDir`.
