---
title: idlip/client
order: 102
section: Reference
description: The loader that resumes server HTML, and the patch functions that compiled chunks import.
---

`idlip/client` is the loader. Importing it boots the loader, which takes over the events that the listener script queued and resumes the page from its state script. Load it as a module script in the page head:

```ts
const loader = `<script type="module" src="/@id/idlip/client"></script>`;
```

In `vite dev` the plugin serves `/@id/idlip/client` as a module that imports `idlip/client`. A chunk that imports from the loader gets the same URL, so the page runs one copy of the loader. The Vite plugin uses `idlip/client` as the input of the client build, so a production page points at the built loader file. See [idlip/vite](./vite.md).

The other exports are what binding, list and handler chunks import. Application code does not call them. The DOM and render helpers are in one module that the chunks share, `idlip/helpers`, which the Vite plugin writes. A build keeps the helpers the chunks use, and ships each one once. The loader starts loading that module with the chunks of the first event, so the first click stays one round trip.

## Patching

### `patch`

```ts
const patch: Patch;
```

The patcher the loader runs after each batch of messages. It compares the previous and next model on the paths of each binding group and loads only the binding chunks whose paths changed.

### `patchList`

```ts
function patchList(...args: Parameters<PatchList>): Promise<void>;
```

Patches the rows of a `<For>` from the previous list to the next one, by key. It moves, adds and removes rows, and patches the bindings of rows that stay. A new row comes from the list chunk's `render(scope, doc)`: the row's HTML, which `patchList` parses, or a fragment that the chunk cloned from a `<template>`, with the row markers, which it inserts as it is. A row of elements, text and holes clones; one with a child, a nested list or condition or raw HTML, or a row inside `<svg>`, renders HTML.

### `diffPaths`

```ts
function diffPaths(
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Readonly<Record<string, string>>,
): Set<string>;
```

Returns the paths whose values differ by reference. A `*` pairs items by index, and under a keyed list also by key. Under a list with a computed key, any change of the list counts as a change of its `*` paths. A keyed segment such as `todos[id=selected]` compares the item found by key on each side.

### `parseHtml`

```ts
function parseHtml(doc: Document, html: string, ns?: 'svg' | 'mathml'): Node[];
```

Parses HTML into nodes through the Trusted Types policy `idlip`. `ns` parses the markup inside an `<svg>` or `<math>` wrapper so it keeps its namespace. A page with `require-trusted-types-for 'script'` must allow the policy: `trusted-types idlip`.

## Blocks

A block is a condition, a list row or another region between two comments. Features that start work when a block is added, such as `<Subscribe>`, use these hooks.

### `onBlock`

```ts
function onBlock(add: (start: Comment) => void, remove: (start: Comment) => void): void;
```

Registers code that runs when a block is added or removed. Hooks are synchronous, and nothing awaits what they start.

### `addBlock`

```ts
function addBlock(start: Comment): void;
```

Calls the add hooks for a block whose markup is in the page.

### `removeBlock`

```ts
function removeBlock(start: Comment): void;
```

Calls the remove hooks for a block whose markup is still in the page.

### `findInnerBlocks`

```ts
function findInnerBlocks(start: Node, end: Node | null): Comment[];
```

Returns the blocks between `start` and `end`, children before parents.

## Children

### `addChild`

```ts
function addChild(path: string, module: string, view: ViewChunk, props: Props): string;
```

Makes a child component, records its slot as live and returns its markup between the boundary comments. A list chunk calls it when a row adds a child.

### `setProp`

```ts
function setProp(path: string, name: string, value: unknown): void;
```

Sets a prop of a live child when its value differs, and marks the child to patch.

## Subscriptions

### `restartSub`

```ts
function restartSub(marker: Element, input: string | undefined, key: string | undefined): void;
```

Called by a binding of a `<Subscribe>` whose `key` reads state. A new `key` stops the run of the marker and starts another with the new `input`. The same `key` changes nothing.
