---
title: Getting started
order: 1
section: Start
description: Build the todo app from an empty folder and run it with Vite and Nitro.
---

This page builds the todo app of `examples/todo` from an empty folder. At the end, `vite` serves a page that the server renders and the browser resumes, and `vite build` writes a server that you run with Node.

You need Node 22 or later and pnpm.

## Create the project

Start in an empty folder:

```bash
mkdir my-todo
cd my-todo
pnpm init
pnpm pkg set type=module
pnpm add idlip
pnpm add -D vite typescript nitro@3.0.260903-beta
```

[Nitro](https://nitro.build) 3 serves the pages in development and builds the server. It is a beta, so pin its version.

The project holds four files:

| File                  | Holds                                                   |
| --------------------- | ------------------------------------------------------- |
| `vite.config.ts`      | The `idlip/vite` plugin and Nitro.                      |
| `tsconfig.json`       | TSX settings with `idlip` as the JSX import source.     |
| `src/todo.tsx`        | The todo component, which renders the whole document.   |
| `src/entry-server.ts` | `fetch(request)`, which returns the page as a response. |

## Configure Vite

`vite.config.ts` adds the plugin, names the server entry and adds Nitro:

```ts
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

The plugin compiles every `src/**/*.tsx` file as an idlip module, so a component file is a plain `.tsx` file with no special extension. Keep helpers and entry files as `.ts`. A `.tsx` file with no component is left alone. A `.tsx` file outside `src` stays plain TSX until you add its folder to the plugin's `modules` option. Import a component with its `.tsx` extension, as in `./counter.tsx`. A `./counter` or `./counter.js` specifier, as NodeNext resolution writes it, does not work for components. `entry` is the server entry, and Nitro calls its default export for each request. Without `nitro()`, the plugin's own dev middleware calls it in `vite dev`.

## Configure TypeScript

`tsconfig.json` keeps JSX as source and takes its types from `idlip`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023", "dom"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "jsxImportSource": "idlip",
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

With `jsxImportSource` set, `tsc` checks each handler call against its parameters and types `e.currentTarget` as the element.

## Write the component

`src/todo.tsx` is the component of `examples/todo`:

```tsx live
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }): JSX.Element {
  let draft = '';
  let todos = props.initial;
  let next = props.initial.length + 1;

  const left = countLeft(todos);

  function setDraft(text: string) {
    draft = text;
  }
  function clear() {
    draft = '';
  }
  function add() {
    if (draft === '') {
      return;
    }
    todos = [...todos, { id: `t${next}`, text: draft, done: false }];
    next = next + 1;
    draft = '';
  }
  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  return (
    <main>
      <form
        on:submit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          on:input={(e) => setDraft(e.currentTarget.value)}
          on:keydown={(e) => {
            if (e.key === 'Escape') {
              clear();
            }
          }}
        />
        <button disabled={draft === ''}>Add</button>
      </form>
      <p>{left} left</p>
      <ul>
        <For each={todos} key={(t) => t.id}>
          {(t) => (
            <li class={{ done: t.done }}>
              <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
              {t.text}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
```

```json live props.json
{
  "initial": [
    {
      "id": "t1",
      "text": "Read the guide",
      "done": true
    },
    {
      "id": "t2",
      "text": "Write a component",
      "done": false
    }
  ]
}
```

The three `let` lines are the state, `left` is derived from it, the four functions are the handlers, and `return` is the view. [Components and state](./components.md) explains each part.

## Render the whole document

The server page is the component too. The root component renders `<html>`, `<head>` and `<body>`, so `return` in `src/todo.tsx` wraps the view above:

```tsx
export default function TodoApp(props: { initial: Todo[] }): JSX.Element {
  // The state, the derived value and the handlers from above.

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>todo</title>
      </head>
      <body>
        <main>{/* the form, the count and the list from above */}</main>
      </body>
    </html>
  );
}
```

The server adds what the framework owns, and you write no HTML string:

- **The doctype**, before `<html>`.
- **The listener**, an inline script at the end of `<head>`. It catches events from the first moment and queues them.
- **The preload links** for the chunks of the first click, and **the loader script**, `idlip/client`, at the end of `<head>`. The plugin gives the server the URL of the loader, both in a build and in `vite dev`.
- **The state script**, at the end of `<body>`, which holds the model.

A `<title>` or a `<meta>` in `<head>` is written as in any page, and the model can fill its holes. A component that does not render `<html>` cannot be the root of a page. [Document head](./head.md) covers the rules.

## Write the server entry

`src/entry-server.ts` answers each request with the page:

```ts
import { renderToResponse } from 'idlip/server';
import TodoApp from './todo.tsx';

const initial = [
  { id: 'a1', text: 'Read the guide', done: true },
  { id: 'a2', text: 'Write a component', done: false },
];

const server = {
  // Nitro calls `fetch` for each request that is not a file of the build.
  async fetch(): Promise<Response> {
    return renderToResponse(TodoApp, { initial }, { csp: true });
  },
};

export default server;
```

`renderToResponse` renders the component and streams the document. `csp: true` makes a nonce for each response, writes it on every script and link that the server adds, and sends the `content-security-policy` header. See [`idlip/server`](./reference/server.md#rendertoresponse) for the policy and its options.

## Run it

```bash
pnpm exec vite dev
```

Open `http://localhost:5173/`. The page shows two todos and `1 left`. Click the second checkbox and the count reads `0 left`. Type a todo and press Enter to add a row, or press Escape to clear the input.

```bash
pnpm exec vite build
node .output/server/index.mjs
```

`vite build` builds the client chunks, the server entry and Nitro's server. It writes everything to `.output`: `public` holds the client files, and `server/index.mjs` serves them and the page. `PORT` sets the port. [Deploying](./deploying.md) covers Vercel, Cloudflare and the content security policy.

## Run the example instead

The repository holds the same app in `examples/todo`. From the repository root:

```bash
pnpm install
pnpm build
pnpm --filter todo dev
```

`pnpm --filter todo start` serves the production build with `PORT` set, such as `PORT=3000`.

## Next

- [Components and state](./components.md): `let`, `const`, handlers and `return`.
- [Views](./views.md): holes, events and the block components.
- [Resuming](./resuming.md): what the browser loads, and when.
