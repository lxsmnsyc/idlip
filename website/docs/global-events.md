---
title: Window and document events
order: 33
section: Guide
description: The window and document elements take event attributes, so a component listens to keys, pointer moves and visibility changes.
---

`<window>` and `<document>` are elements of the view that take event attributes only. They render nothing visible. Their events go through the same queue and handler chunks as a click on a button.

## Keys, pointer moves and visibility

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Canvas(): JSX.Element {
  let x = 0;
  let open = true;
  let hidden = 0;

  function move(clientX: number) {
    x = clientX;
  }
  function close() {
    open = false;
  }
  function hide() {
    hidden = hidden + 1;
  }

  return (
    <main>
      <window
        on:keydown={(e) => {
          if (e.key === 'Escape') {
            close();
          }
        }}
        latest:pointermove={(e) => move(e.clientX)}
      />
      <document on:visibilitychange={hide} />
      <p>{x}</p>
      <p>{open ? 'open' : 'closed'}</p>
      <p>{hidden}</p>
    </main>
  );
}
```

The event attributes follow the rules of [events](./views.md#events). They take a handler or an arrow with one handler call, event paths such as `e.clientX`, and a key test. The listener runs the key test, so a key other than Escape loads nothing.

The test `packages/idlip/test/client/global/global.test.ts` covers a `keydown` listener that stops with its block and `latest:pointermove`.

## Queued or latest

Every event queues by default and keeps its own value. While a handler chunk loads or a patch runs, each `input` or `keydown` waits its turn and none is lost.

`latest:` instead of `on:` keeps only the newest event. A new event replaces the pending one for the same element and event name. Use it for `pointermove`, `scroll` and `resize`, where only the last position matters. `latest:` works on any element, not only `<window>` and `<document>`.

Dev builds warn in the console when 20 events of one type wait for one element, and the warning suggests `latest:`. Production builds drop the warning and its text.

## Server, resume and unmount

- **Server.** The `<window>` above renders as `<template i-global="window" on:keydown='["close",[],"key:Escape"]' on:pointermove='["move",[["$event","clientX"]],"latest"]'>`. Each message is the same JSON as on a button, with the key test and `latest` as flags. Nothing else is serialized, and the element has no chunk of its own.
- **Resume.** The early listener script in `<head>` adds one listener on `window` or `document` per event type that a `<window>` or `<document>` in the module uses, even inside a condition, so an element that a patch adds later is heard too. A page with no such element gets none. An event before the loader starts is queued like an early click.
- **Unmount.** When the block that holds the element is removed, its template goes with it, and the listener finds no message to queue. The test above shows that the events come back when the block returns.

## Common errors

| Rule id           | Cause                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| `global-attr`     | An attribute on `<window>` or `<document>` that is not `on:` or `latest:`. |
| `global-children` | `<window>` or `<document>` has children.                                   |
