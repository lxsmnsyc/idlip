---
title: Getting started
order: 1
section: Start
description: Build the todo app from an empty folder and run it with Vite.
---

This page builds the todo app of `examples/todo` from an empty folder. At the end, `vite` serves a page that the server renders and the browser resumes.

You need Node 22 or later and pnpm.

## Install idlip

The `idlip` package on npm is a placeholder until the 0.1 release. Its `0.0.1-stage` version has none of the subpaths this page uses. Build a package file from the repository instead:

```bash
git clone https://github.com/lxsmnsyc/idlip.git
cd idlip
pnpm install
pnpm --filter idlip build
pnpm --filter idlip pack --pack-destination "$PWD/.."
```

The last command writes `idlip-0.0.0-stage.tgz` next to the `idlip` folder.

## Create the project

Start in an empty folder next to the package file:

```bash
mkdir my-todo
cd my-todo
pnpm init
pnpm pkg set type=module
pnpm add ../idlip-0.0.0-stage.tgz
pnpm add -D vite typescript
```

After the 0.1 release, `pnpm add idlip` replaces the line with the package file.

The project holds four files:

| File                  | Holds                                               |
| --------------------- | --------------------------------------------------- |
| `vite.config.ts`      | The `idlip/vite` plugin.                            |
| `tsconfig.json`       | TSX settings with `idlip` as the JSX import source. |
| `src/todo.tsx`        | The todo component.                                 |
| `src/entry-server.ts` | `render()`, which returns the page HTML.            |

## Configure Vite

`vite.config.ts` adds the plugin and names the server entry:

```ts
import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' })],
});
```

The plugin compiles every `src/**/*.tsx` file as an idlip module, so a component file is a plain `.tsx` file with no special extension. Keep helpers and entry files as `.ts`. A `.tsx` file with no component is left alone. A `.tsx` file outside `src` stays plain TSX until you add its folder to the plugin's `modules` option. Import a component with its `.tsx` extension, as in `./counter.tsx`. A `./counter` or `./counter.js` specifier, as NodeNext resolution writes it, does not work for components. In `vite dev` it answers each HTML request with the string that `render(url)` of the entry returns.

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

## Write the server entry

`src/entry-server.ts` renders the component into a page:

```ts
import { render as renderComponent, renderListener } from 'idlip/server';
import TodoApp from './todo.tsx';

const initial = [
  { id: 'a1', text: 'Read the guide', done: true },
  { id: 'a2', text: 'Write a component', done: false },
];

export async function render(): Promise<string> {
  const body = await renderComponent(TodoApp, { initial });
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>todo</title>' +
    renderListener() +
    '<script type="module" src="/@id/idlip/client"></script>' +
    `</head><body>${body}</body></html>`
  );
}
```

The page needs three parts:

- **`renderListener()`** returns an inline script for `<head>`. It catches events from the first moment and queues them.
- **The loader**, `idlip/client`, is the one module script. In `vite dev` its URL is `/@id/idlip/client`.
- **The body** from `render()` of `idlip/server` holds the markup and a state script with the model.

## Run it

```bash
pnpm exec vite
```

Open `http://localhost:5173/`. The page shows two todos and `1 left`. Click the second checkbox and the count reads `0 left`. Type a todo and press Enter to add a row, or press Escape to clear the input.

`pnpm exec vite build` writes the client chunks to `dist/client` and the server entry to `dist/server`. A production server must also find the built loader file. `examples/todo/vite.config.ts` reads it from the client manifest and serves the page in `vite preview` under a strict content security policy.

## Run the example instead

The repository holds the same app in `examples/todo`. From the repository root:

```bash
pnpm install
pnpm build
pnpm --filter todo dev
```

`pnpm --filter todo preview` serves the production build at `http://127.0.0.1:4173/`.

## Next

- [Components and state](./components.md): `let`, `const`, handlers and `return`.
- [Views](./views.md): holes, events and the block components.
- [Resuming](./resuming.md): what the browser loads, and when.
