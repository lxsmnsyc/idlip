---
title: idlip/testing
order: 105
section: Reference
description: Mount a component in a test, click and type as a user does, and wait until chunks and patches settle.
---

`idlip/testing` runs a component the way a page does, in the DOM of a test. `mount` compiles a `*.idlip.tsx` source, renders it on the server, resumes it in the document and serves its chunks from memory. Use it with the `happy-dom` environment of Vitest, or any global `document`.

```ts
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { mount } from 'idlip/testing';
import { expect, it } from 'vitest';

// counter.idlip.tsx: `let count = 0`, `increment()` adds one, the button shows `count`.
const source = readFileSync(new URL('./counter.idlip.tsx', import.meta.url), 'utf8');

it('counts clicks', async () => {
  const page = await mount(source, {});
  page.click('button');
  await page.settled();
  expect(page.text('button')).toBe('1');
  expect(page.loaded().toSorted()).toEqual(['binding=count', 'handler=increment']);
  page.stop();
});
```

One page is mounted at a time: call `stop` before the next `mount`.

## Mounting

### `mount`

```ts
function mount(
  source: string,
  props: Record<string, unknown>,
  options?: MountOptions,
): Promise<MountedPage>;
```

Compiles `source`, renders it on the server with `props`, and resumes it in the document. It throws when the source has an error diagnostic, or when another page is mounted.

### `MountOptions`

```ts
interface MountOptions {
  check?: boolean;
  id?: string;
  nonce?: string;
  expectCaught?: boolean;
}
```

| Option         | Default              | Meaning                                                                                                                                                                                               |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`        | `true`               | After each settled step, renders the view on the server from the new model and fails when the patched DOM differs. A mismatch is a stale binding, for example from a helper with a hidden dependency. |
| `id`           | `/src/app.idlip.tsx` | The Vite id of the module, which names its chunks.                                                                                                                                                    |
| `nonce`        | none                 | Written on the state script.                                                                                                                                                                          |
| `expectCaught` | `false`              | Lets a `<Try>` catch errors. By default `settled` rethrows an error that a region caught, so a test does not pass over a swapped region by mistake. Set it in a test that expects the catch view.     |

### `MountedPage`

```ts
interface MountedPage {
  readonly root: HTMLElement;
  get: (selector: string) => HTMLElement;
  text: (selector: string) => string;
  click: (selector: string) => void;
  input: (selector: string, value: string) => void;
  settled: () => Promise<void>;
  loaded: () => string[];
  stop: () => void;
}
```

| Member    | Does                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `root`    | The element that holds the page.                                                                                                                                                                                                     |
| `get`     | Returns the first element that matches a selector. Throws when none does.                                                                                                                                                            |
| `text`    | Returns the text content of the first element that matches a selector.                                                                                                                                                               |
| `click`   | Clicks an element.                                                                                                                                                                                                                   |
| `input`   | Types a value into an `<input>` or `<textarea>` and fires `input`.                                                                                                                                                                   |
| `settled` | Waits until chunk loads and patches have settled. Throws the first error the loader reported, or that a `<Try>` caught unless `expectCaught` is set. With `check`, then compares the page with a server render of the current model. |
| `loaded`  | The names of the chunks evaluated so far, in order, such as `handler=toggle`.                                                                                                                                                        |
| `stop`    | Removes the listeners, the page and its head elements. Later events load nothing.                                                                                                                                                    |
