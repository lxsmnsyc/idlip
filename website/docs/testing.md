---
title: Testing
order: 25
section: Guide
description: Test a component with mount from idlip/testing, check which chunks a click loads, and catch stale bindings.
---

`mount` from `idlip/testing` runs a component the way a page does. It compiles the source, renders it on the server, resumes it in the test's `document` and serves the chunks from memory. A click in the test goes through the real listener and loader.

## Set up Vitest

`mount` needs a global `document`. With Vitest, use the `happy-dom` environment, per file or in the config:

```bash
pnpm add -D vitest happy-dom
```

```ts
// @vitest-environment happy-dom
```

## A first test

Pass the source text of the module and its props. The todo app from [Getting started](./getting-started.md) is tested like this:

```ts
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from 'idlip/testing';
import type { MountedPage } from 'idlip/testing';
import { afterEach, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, 'todo.tsx'), 'utf8');
const initial = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build the runtime', done: false },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

it('loads the toggle handler and one binding chunk on the first click', async () => {
  page = await mount(source, { initial });
  expect(page.loaded()).toEqual([]);

  page.click('li:nth-child(2) input');
  await page.settled();

  expect(page.loaded().toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle']);
  expect(page.text('p')).toBe('0 left');
});

it('adds a todo', async () => {
  page = await mount(source, { initial });
  page.input('form input', 'Ship it');
  await page.settled();
  page.get('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await page.settled();

  expect(page.root.querySelectorAll('li')).toHaveLength(3);
  expect(page.text('p')).toBe('2 left');
});
```

- **`click`, `input` and `get`** take a CSS selector. `get` throws when nothing matches. Fire other events with `dispatchEvent` on the element, as for the submit above.
- **`settled()`** waits until the chunks have loaded and the page has patched. Await it after each step.
- **`loaded()`** lists the chunks evaluated so far, such as `handler=toggle` and `binding=todos.*.done`. A handler chunk and its binding chunks start together, so sort the list before you compare it.
- **`stop()`** removes the page and its listeners. One page can be mounted at a time, so stop it after each test.

## The server check

After each `settled()`, `mount` renders the view again on the server from the current model and compares it with the page. A difference fails the test and names the first node that differs:

```text
The patched page differs from a server render of its model. root > <ul>[0] > <li>[2]: attribute data-r is "2" in the page and "4" in the server render
```

The check finds a binding that did not patch: a hole whose paths the compiler missed, or a bug in idlip. Turn it off with `mount(source, props, { check: false })` in a test that changes the DOM by hand. Typing into a field that the model does not hold is one case.

## Errors

`settled()` rejects with the first error since the last step: a handler that threw, a chunk that failed, or a patch that threw. The page keeps working after it:

```ts
page.click('#save');
await expect(page.settled()).rejects.toThrow('save failed');
```

A hole that a `<Try>` caught is an error too, so a test does not pass over a catch view by mistake. In a test that expects the catch view, pass `expectCaught`:

```ts
page = await mount(source, {}, { expectCaught: true });
page.input('input', 'ab');
await page.settled();
expect(page.text('p')).toContain('not a number');
```

## Children

A module that renders stateful children needs their sources. Pass `children`, one source for each specifier the module imports a child with. The children compile as children, and their chunks load like the module's:

```ts
page = await mount(boardSource, { items }, { children: { './counter.tsx': counterSource } });
```

## Head and titles

`<Head>` elements go into `document.head`, and `stop()` removes them. The title updates one task after the patch, so wait a tick before you read `document.title`:

```ts
page.click('button');
await page.settled();
await new Promise((resolve) => setTimeout(resolve, 0));
expect(document.title).toBe('Inbox (0)');
```

## Limits

- **Imports.** Imports from `idlip` work. An import of another file, such as a helper module, is not resolved in memory, so keep helpers in the module under test.
- **happy-dom** does not parse MathML into its namespace. Test MathML in a browser.

See [idlip/testing](./reference/testing.md) for every option.
