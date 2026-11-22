---
title: Document head
order: 20
section: Guide
description: Set the title and meta tags from a component with Head, and write them into the page with renderPage.
---

`<Head>` from `idlip` puts elements in the document `<head>`. Holes in them follow the model like any other hole, so a title can show a count that a click changes.

## A title and a meta tag

```tsx
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Inbox(): JSX.Element {
  let unread = 3;

  const title = `Inbox (${unread})`;

  function read() {
    unread = 0;
  }

  return (
    <main>
      <Head>
        <title>{title}</title>
        <meta name="description" content={`${unread} unread messages`} />
      </Head>
      <button on:click={read}>Mark all read</button>
    </main>
  );
}
```

A click on the button patches the title and the `content` of the meta tag, as it would patch a hole in the body.

## Rules

- **Elements only.** A `<Head>` holds elements such as `<title>`, `<meta>` and `<link>`. They take no events, `ref` or `html`.
- **One title per block.** A second `<title>` in the same `<Head>` is the error `head-title-twice`.
- **A hole in a title is its only content.** Build the text in a `const`, as `title` above.
- **A title belongs in a `<Head>`.** A `<title>` elsewhere in the view is the error `title-outside-head`. A `<title>` inside `<svg>` is an SVG title and is allowed.

## Several blocks

A `<Head>` can sit anywhere in the view: in a condition, in a `<For>` row, in a `<Try>` or in a child component. Its elements are added when the block appears and removed when it leaves.

When more than one block has a title, the last one in page order wins:

```tsx
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Editor(): JSX.Element {
  let count = 1;
  let editing = false;

  const title = `${count} notes`;

  function add() {
    count = count + 1;
  }
  function toggle() {
    editing = !editing;
  }

  return (
    <main>
      <Head>
        <title>{title}</title>
      </Head>
      <button on:click={add}>Add</button>
      <button on:click={toggle}>Edit</button>
      {editing && (
        <Head>
          <title>Editing</title>
          <meta name="robots" content="noindex" />
        </Head>
      )}
    </main>
  );
}
```

While `editing` is true the tab reads `Editing`. When it turns false, the second block leaves with its meta tag, and the tab reads `1 notes` again, or the current count.

Page order is the order in which the server renders the blocks. A `<Head>` in a child component can rank after a later `<Head>` of its parent, so its title can win over that one.

## On the server

`render()` of `idlip/server` returns only the body and drops head output. Use `renderPage()`, which returns `{ head, body }`:

```ts
import { renderListener, renderPage } from 'idlip/server';
import Inbox from './inbox.tsx';

export async function render(loader: string): Promise<string> {
  const page = await renderPage(Inbox, {});
  return (
    `<!doctype html><html><head><meta charset="utf-8">${page.head}` +
    renderListener() +
    `<script type="module" src="${loader}"></script>` +
    `</head><body>${page.body}</body></html>`
  );
}
```

- **`head`** holds the elements of every block. The winning title comes first, since the browser reads the first `<title>` in `<head>`.
- **Do not write a `<title>` of your own** in the host page when a component sets one. The loader leaves a host title alone.

The title update in the browser runs one task after the patch, since the loader watches `<head>` for changes. A test that reads `document.title` waits one tick after `settled()`.

See [idlip](./reference/idlip.md#head) and [idlip/server](./reference/server.md#renderpage) for the signatures.
