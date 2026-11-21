# Change request: compiled-format, hot update message

From: `hmr`. Target: a new dev-only section of `contracts/compiled-format.md`.

Status: open.

## Change

- In `vite dev`, after an edit of a `*.idlip.tsx` file, the plugin sends one custom Vite event to the client environment: `idlip:hot`. The payload is:

```ts
interface HotMessage {
  readonly module: string; // manifest.module, such as /src/todo.idlip.tsx
  readonly kind: 'swap' | 'remount';
  readonly chunks: readonly string[]; // chunk URLs
  readonly timestamp: number;
}
```

- `swap`: the server module (markup, manifest, chunk ids) is the same. `chunks` holds the URLs of the chunks whose code changed. The loader imports each again, at the URL with `t=<timestamp>`, and the next event runs the new code on the same model.
- `remount`: the server module changed. `chunks` holds every chunk URL of the module. The loader fetches the page, replaces the `body`, reads the new state records, and patches each root from its fresh model to the model it had. A field of the old model that the new model lacks is dropped. A field that the new model adds takes its initial value.
- A module that does not compile sends `full-reload`. An edit that changes no chunk sends nothing.
- The loader listens only behind `import.meta.hot`, so a build holds none of it.

## Why

The loader needs to know which chunk URLs to import again, and whether the markup it resumed is stale.
