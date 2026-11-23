# idlip

> A resumable UI framework built on Model-View-Update.

idlip compiles TSX function components into server-rendered HTML and small client chunks. The page runs no component code on load. The server writes the model into the page, and the first click loads only the handler it runs and the bindings of the model paths that handler changed.

## Install

```bash
pnpm add idlip
pnpm add -D vite typescript nitro@3.0.260903-beta
```

idlip needs Node 22 or newer, and Vite. [Nitro](https://nitro.build) 3 serves the pages in development and builds the server for Node, Vercel, Cloudflare and other hosts. It is a beta, so pin its version.

```ts
// vite.config.ts
import { idlip } from 'idlip/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    idlip({ entry: '/src/entry-server.ts' }),
    // The loader asks for build.js to learn which build the server runs, so it must not be cached.
    nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } }),
  ],
});
```

The plugin compiles every `src/**/*.tsx` file as an idlip module. In `tsconfig.json`, set `"jsx": "preserve"` and `"jsxImportSource": "idlip"`. Without `nitro()`, the plugin's own dev middleware calls the same entry in `vite dev`.

## A component

```tsx
// src/counter.tsx
import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  const double = count * 2;

  function increment() {
    count = count + 1;
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Counter</title>
      </head>
      <body>
        <main>
          <button on:click={increment}>Clicked {count} times</button>
          <p>Double: {double}</p>
        </main>
      </body>
    </html>
  );
}
```

The `let` lines are the model, `const` values are derived from it, the functions are the handlers, and `return` is the view. A click loads the chunk of `increment`, runs it on the model, and patches the button text and the paragraph. The view does not render again.

The root component renders the whole document. The server adds the doctype, the listener, the loader script and the state script.

```ts
// src/entry-server.ts
import { renderToResponse } from 'idlip/server';
import Counter from './counter.tsx';

const server = {
  async fetch(): Promise<Response> {
    return renderToResponse(Counter, { start: 0 }, { csp: true });
  },
};

export default server;
```

`pnpm exec vite dev` serves it. `pnpm exec vite build` writes `.output`, and `node .output/server/index.mjs` serves the build. `csp: true` makes a nonce for each response, writes it on every script the server adds, and sends the content security policy.

## What it includes

- `idlip`: `For`, `Try`, `Head` and `Subscribe`, the effects `Dom`, `Random` and `Time`, and the sources `timer`, `socket`, `eventSource` and `media`.
- `idlip/vite`: the Vite plugin. It compiles components, splits client code per handler and binding, and gives the server the chunk URLs and the loader URL.
- `idlip/server`: `renderToResponse`, `renderToStream`, `render`, `streamParts`, `renderListener` and `renderPreload`.
- `idlip/client`: the loader that runs in the browser, about 4 kB with gzip.
- `idlip/testing`: `mount`, which runs a component in a DOM test with the real compiled chunks.
- `idlip/compiler`: the compiler, for tools and editors.

## Documentation

- [Getting started](https://github.com/lxsmnsyc/idlip/blob/main/website/docs/getting-started.md)
- [Components and state](https://github.com/lxsmnsyc/idlip/blob/main/website/docs/components.md)
- [All guides and reference](https://github.com/lxsmnsyc/idlip/tree/main/website/docs)

idlip is at 0.x. The page format can change between versions, so the server and the client must come from the same version.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
