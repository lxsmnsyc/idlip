---
title: idlip/vite
order: 104
section: Reference
description: The Vite plugin that compiles *.tsx modules, emits their chunks, gives the server the chunk and loader URLs and renders pages in vite dev without Nitro.
---

`idlip/vite` is the build integration. It compiles `*.tsx` modules, emits one client chunk per handler, binding group and list, and gives the server module the chunk URLs and the URL of the loader. Nitro serves the pages in `vite dev`. Without Nitro, the plugin calls the entry itself.

```ts
import { idlip } from 'idlip/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' }), nitro()],
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
  server?: false;
  client?: string;
  compile?: (source: string, id: string, options?: CompileOptions) => CompileResult;
  skew?: boolean;
}
```

| Option    | Default                       | Meaning                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules` | `src/**/*.tsx`                | Globs of the idlip modules, relative to the root. The plugin compiles a matched file only when it declares a function component. A `.tsx` file with none, such as an entry, and a file that no glob matches go to Vite as plain TSX. A component in a file outside the globs gives a warning, and rendering one as a child is a build error. Both name this option. |
| `entry`   | none                          | The server entry, such as `/src/entry-server.ts`. Its default export is `{ fetch(request) }`, which returns the page as a `Response`. Nitro calls it, and so does the dev middleware of the plugin when the config has no Nitro. It is also the input of the ssr build when the config sets none.                                                                   |
| `server`  | on                            | `false` keeps the dev middleware off, for a project whose own server renders the pages. It is off already when the config has `nitro()`, which the plugin finds by its plugin name `nitro:main`.                                                                                                                                                                    |
| `client`  | `idlip/client`                | The input of the client build: the loader. Every module an idlip chunk imports must be in its static graph.                                                                                                                                                                                                                                                         |
| `compile` | `compile` of `idlip/compiler` | The compiler to run.                                                                                                                                                                                                                                                                                                                                                |
| `skew`    | on in a production build      | Recover when a page cached from an older build meets this one.                                                                                                                                                                                                                                                                                                      |

With `skew`, pages carry a build id, the client build keeps the files of the previous build, and the loader reloads once when a chunk fails and the server runs another build. The client build writes `build.js` next to the loader. Serve it with `Cache-Control: no-store` or a short max age: the loader imports it to learn which build the server runs, and a cached copy hides a new deploy.

Retention reads `<build.outDir>/.idlip/builds.json`, so keep `build.outDir` between deploys, or restore the previous build before building. On a clean checkout the build keeps nothing, and a page cached from the last deploy finds its chunks gone and reloads. Only files of the build are deleted, never files from `publicDir`.

## With Nitro

`nitro()` from `nitro/vite` goes after `idlip()` in `plugins`. The plugin finds it by its plugin name, `nitro:main`, and leaves `vite dev` to it, so the two never both answer a page. The loader URL and the chunk URLs reach the server in the build, so it reads no manifest.

- **`build.js` needs `no-store`.** Nitro serves files of `assets/` with `cache-control: public, max-age=31536000, immutable`. Add `nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } })`.
- **The previous build is not kept.** Nitro writes the client files to `.output/public` and empties it on each build, so `skew` keeps no files of the build before. A page cached from the last deploy finds its chunks gone and reloads once. Keep the client folder between deploys to keep the files.
