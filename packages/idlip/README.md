# idlip

> A resumable UI framework built on Model-View-Update.

idlip compiles TSX function components into server-rendered HTML and small client chunks. The page runs no component code on load. The server writes the model into the page, and the first click loads only the handler it runs and the bindings of the model paths that handler changed.

## Install

```bash
pnpm add idlip
pnpm add -D vite typescript
```

idlip needs Node 22 or newer, and Vite.

```ts
// vite.config.ts
import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' })],
});
```

The plugin compiles every `src/**/*.tsx` file as an idlip module. In `tsconfig.json`, set `"jsx": "preserve"` and `"jsxImportSource": "idlip"`.

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
    <main>
      <button on:click={increment}>Clicked {count} times</button>
      <p>Double: {double}</p>
    </main>
  );
}
```

The `let` lines are the model, `const` values are derived from it, the functions are the handlers, and `return` is the view. A click loads the chunk of `increment`, runs it on the model, and patches the button text and the paragraph. The view does not render again.

```ts
// src/entry-server.ts
import { render as renderComponent, renderListener } from 'idlip/server';
import Counter from './counter.tsx';

export async function render(): Promise<string> {
  const body = await renderComponent(Counter, { start: 0 });
  return `<!doctype html><html><head>${renderListener()}<script type="module" src="/@id/idlip/client"></script></head><body>${body}</body></html>`;
}
```

## What it includes

- `idlip`: `For`, `Try`, `Head` and `Subscribe`, the effects `Dom`, `Random` and `Time`, and the sources `timer`, `socket`, `eventSource` and `media`.
- `idlip/vite`: the Vite plugin. It compiles components, splits client code per handler and binding, and serves pages in development.
- `idlip/server`: `render`, `renderPage`, `renderListener` and `renderPreload`.
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
