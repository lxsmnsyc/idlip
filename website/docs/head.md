---
title: Document head
order: 20
section: Guide
description: Set the title and meta tags in the head of the document component, or from any component with Head.
---

`<Head>` from `idlip` puts elements in the document `<head>`. Holes in them follow the model like any other hole, so a title can show a count that a click changes.

## A title and a meta tag

```tsx live
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

## The head of the document

The root component renders `<html>`, and its `<head>` follows the same rules as `<Head>`. It is the first block of the page:

```tsx
export default function Inbox(props: { unread: number }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Inbox</title>
      </head>
      <body>{/* ... */}</body>
    </html>
  );
}
```

- **The document title is the default title.** A `<Head>` anywhere in the body ranks after the document head, so its title wins. When that block leaves, the document title shows again.
- **A head with no hole is markup.** The loader needs no code for it.
- **A `<style>` is markup, with no nonce.** Under `csp: true` the policy blocks it, so allow it with `csp: { extend: { 'style-src': [...] } }` (see [Deploying](./deploying.md#content-security-policy)), or use a `<link rel="stylesheet">` from `'self'`.
- **A `<script>` is an error**, with or without `src` (`document-head-script`). The server writes a nonce on its own scripts only, so the policy would block it. The loader starts the page, and handlers and effects run code.
- **A head with a hole is a `<Head>` block.** A title that shows a count, or a `content` that follows the model, patches as in a `<Head>`.
- **`<html>` and `<body>` take bound attributes**, such as `lang={lang}` or `class={theme}`. An event, `ref` or `html` on `html`, `head` or `body` is an error.
- **The skeleton is fixed.** `<html>` holds one `<head>` and then one `<body>`. A condition, a `<For>` or a `<Try>` around them, and an `html`, `head` or `body` in any other component, is the error `document-element-misplaced`. Put a changing head element in a `<Head>` in the body.
- **A component that is not the root renders no `<html>`.** The server rejects a root that does not render it.
- **A change to `<html>` or to the head in `vite dev`** loads the page again, since a remount swaps `<body>` only.

## Rules

- **Elements only.** A `<Head>` holds elements such as `<title>`, `<meta>` and `<link>`. They take no events, `ref` or `html`.
- **One title per block.** A second `<title>` in the same `<Head>` is the error `head-title-twice`.
- **A hole in a title is its only content.** Build the text in a `const`, as `title` above.
- **A title belongs in a `<Head>`.** A `<title>` elsewhere in the view is the error `title-outside-head`. A `<title>` inside `<svg>` is an SVG title and is allowed.

## Several blocks

A `<Head>` can sit anywhere in the view: in a condition, in a `<For>` row, in a `<Try>` or in a child component. Its elements are added when the block appears and removed when it leaves.

When more than one block has a title, the last one in page order wins:

```tsx live
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

`renderToResponse()`, `renderToStream()` and `streamParts()` of `idlip/server` write the elements of every block into the `<head>` of the document component, so the entry writes nothing:

```ts
import { renderToResponse } from 'idlip/server';
import Inbox from './inbox.tsx';

const server = {
  async fetch(): Promise<Response> {
    return renderToResponse(Inbox, { unread: 3 });
  },
};

export default server;
```

- **The winning title comes first in `<head>`**, since the browser reads the first `<title>`. The head elements of the document follow it, so `<meta charset>` stays near the start. The elements of the `<Head>` blocks come next, and the listener, the preload links and the loader script come last.
- **`render()` returns it as `head`.** It is the parts of the first render, and a page that is not a document component, such as a test, takes `head` and `body` from it.

The title update in the browser runs one task after the patch, since the loader watches `<head>` for changes. A test that reads `document.title` waits one tick after `settled()`.

See [idlip](./reference/idlip.md#head) and [idlip/server](./reference/server.md#render) for the signatures.
