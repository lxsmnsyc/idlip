---
title: Resuming
order: 12
section: Guide
description: What the server sends, what the browser loads before the first event, and what the first click loads.
---

The browser does not run view code to start the page. The server sends the HTML, the model and a small listener. A click loads the handler it names and the binding chunks of the model paths that changed. The sizes on this page come from the site's build of `examples/todo`: `pnpm --filter website build` measures them into `website/dist/demo-server/demo.json`. They were measured on 2026-11-22. A change to the loader or the compiler changes them, and they are updated by hand.

## What the server sends

`render()` of `idlip/server` writes plain markup with data attributes. The second todo of the app from [Getting started](./getting-started.md) renders as follows, with line breaks added:

```html
<li i-a="4">
  <input type="checkbox" on:click='["toggle",["a2"]]' i-a="5 7" />
  <!--t6-->Write a component<!--/t-->
</li>
```

- **`on:click`** holds the message as data: the handler name and its arguments.
- **`i-a`** and the `<!--t6-->` comments mark the places that bindings patch.
- **The state script**, `<script i-state>` at the end of the body, holds the model, the props and the manifest. The manifest lists each handler, its chunk and the model paths it writes.

The `<head>` holds two scripts:

- **The listener** from `renderListener()`, inline. It listens for the event types of the page and queues each event. It is 1698 B, or 991 B with gzip.
- **The loader**, `idlip/client`, one module script. It starts at the first event.

## Before the first event

The page loads the document and the loader, and nothing else. The state is not decoded yet.

| Request                        | Raw     | gzip -9 |
| ------------------------------ | ------- | ------- |
| `GET /` (document)             | 4787 B  | 2089 B  |
| `GET /assets/loader.<hash>.js` | 10001 B | 3986 B  |
| Total                          | 14788 B | 6075 B  |

The e2e test records every request from the navigation on, and fails if any other request appears. Moving the pointer and focusing an element are not handled events and load nothing.

## The first click

A click on the second checkbox runs these steps:

1. The listener reads `["toggle",["a2"]]` from the checkbox and queues the message `toggle("a2")`.
2. The loader decodes the state script, once for the page.
3. The loader imports the `toggle` handler chunk, and with it the helpers module the chunks share. It runs the handler on the model. The result is the next model.
4. The manifest says `toggle` writes `todos.*.done`. The loader imports the binding chunk of that path only. It asks for all three files before any arrives, so the click costs one round trip.
5. The binding chunk patches the checkbox, the `done` class of the row and the `0 left` count, since `countLeft(todos)` reads `todos.*.done`.

```figure message-trace

```

The click makes three requests:

| Request                                           | Raw    | gzip -9 |
| ------------------------------------------------- | ------ | ------- |
| `GET /assets/todo.handler.toggle.<hash>.js`       | 118 B  | 119 B   |
| `GET /assets/_idlip-helpers.<hash>.js`            | 1962 B | 967 B   |
| `GET /assets/todo.binding.todos._.done.<hash>.js` | 342 B  | 236 B   |
| Total                                             | 2422 B | 1322 B  |

A built chunk file is named `<module>.<kind>.<name>.<hash>.js`, and a `_` segment stands for `*` in the path. `_idlip-helpers.<hash>.js` holds the DOM and render helpers every chunk of the build imports. It loads once, with the first chunks. The bindings of `todos.*.text`, `todos.*.id` and `draft`, the list chunk and the other three handlers stay on the server.

A second click on any checkbox loads nothing. The chunks are already in the page, and the state was decoded once.

## Write sets

The compiler reads each handler and lists the model paths it writes. The loader loads the binding chunks of those paths. For the todo app:

| Handler    | Writes                   | Binding chunks loaded                                 |
| ---------- | ------------------------ | ----------------------------------------------------- |
| `setDraft` | `draft`                  | `draft`                                               |
| `clear`    | `draft`                  | `draft`                                               |
| `toggle`   | `todos.*.done`           | `todos.*.done`                                        |
| `add`      | `todos`, `next`, `draft` | `todos.*.done`, `todos.*.id`, `todos.*.text`, `draft` |

`toggle` maps over `todos` and changes only `done`, so its write set is `todos.*.done` and not all of `todos`.

## A click before the scripts load

The listener is inline in `<head>`, so it runs before the loader arrives. A click while the loader is still on the network goes into the queue. When the loader starts, it runs the queued messages in order. The e2e test holds every script request, clicks, and then checks that the page updates once the scripts load.

## Preload the first click

The first click waits for one round trip to fetch its chunks. `renderPreload(page.chunks, page.manifests)` from `idlip/server`, with the result of `renderPage`, returns `<link rel="modulepreload">` tags for the chunks of the first click, so the browser fetches them with the page. For the todo page it names the shared helpers module, the `toggle` handler and the `todos.*.done` binding.

- **Opt-in.** `examples/todo` calls it, and `?preload=off` leaves the links out. The counts above are without it.
- **With it on**, the first click makes no request, and the page makes three more requests at load.
- **`format: 'header'`** returns a `Link` header value instead, for a 103 Early Hints response.
- **`idlip({ preimport: true })`** makes the loader import the preloaded modules at idle after `load`, so the click does not wait for an import task.
