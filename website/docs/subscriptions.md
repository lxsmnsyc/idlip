---
title: Subscriptions
order: 31
section: Guide
description: Subscribe reads a stream of values while its block is on the page and sends each value to a handler.
---

A subscription reads a stream of values, such as timer ticks or socket messages, and sends each value to a handler as a message. It is a `<Subscribe>` node in the view. It starts when the block it sits in is added to the page and stops when the block is removed. The state that turns it on is the condition around it. No handle is kept by hand.

## A timer

```tsx live
import { Subscribe, timer } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

type Clock = { state: 'stopped' } | { state: 'running'; ms: number; now: number };

export default function Ticker(): JSX.Element {
  let clock = { state: 'stopped' } satisfies Clock as Clock;

  function start(ms: number) {
    clock = { state: 'running', ms, now: 0 };
  }
  function stop() {
    clock = { state: 'stopped' };
  }
  function tick(now: number) {
    if (clock.state === 'running') {
      clock = { ...clock, now };
    }
  }

  return (
    <main>
      <button on:click={() => start(1000)}>Every second</button>
      <button on:click={() => start(100)}>Every 100 ms</button>
      <button on:click={stop}>Stop</button>
      {clock.state === 'running' && (
        <Subscribe key={clock.ms} to={timer} input={clock.ms} on:value={tick} />
      )}
      <p>{clock.state === 'running' ? clock.now : 'stopped'}</p>
    </main>
  );
}
```

`<Subscribe to={source} input={value} on:value={handler}>` calls `source(input, signal)` and dispatches `handler` with each value it yields. `tsc` checks `input` against the source's first parameter and the yielded type against the handler.

- `to` is an imported or module-level async generator function.
- `input` is read once, at start. The runtime never compares inputs.
- `key` restarts the source. When the value of `key` changes, the runtime stops the run and starts a new one with the new `input`. Above, a click on "Every 100 ms" while the timer runs every second restarts it. When `input` reads state, `key` must read the same paths, so a stale input cannot go unnoticed.
- `<Subscribe>` takes no children.

The test `packages/idlip/test/client/subs/subs.test.ts` runs a clock like this one, a keyed restart and subscriptions in `<For>` rows.

## Stock sources

`idlip` exports four sources. Each one ends promptly when its signal aborts.

| Source             | Yields                                              | Slow reader                      |
| ------------------ | --------------------------------------------------- | -------------------------------- |
| `timer(ms)`        | `Date.now()` every `ms`.                            | Gets only the latest tick.       |
| `socket(url)`      | The text messages of a WebSocket. Ends on close.    | Buffer of 100, drops the oldest. |
| `eventSource(url)` | The data of server-sent events.                     | Buffer of 100, drops the oldest. |
| `media(query)`     | Whether the media query matches, now and on change. | Gets only the latest value.      |

`socket` also takes `{ url, protocols }`, and `eventSource` takes `{ url, event }` to listen for an event name other than `message`. The [reference](./reference/idlip.md#subscription-sources) lists the types.

## A custom source

A source is an async generator function of `(input, signal)`. A source with several parameters takes one input object. It must end its `await`s when the signal aborts. `until(signal, promise)` and `Time.sleep(ms, signal)` reject on abort. This source polls a `/status` endpoint of your server:

```tsx
import { Subscribe, Time, until } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

async function* poll(input: { url: string; ms: number }, signal: AbortSignal) {
  while (!signal.aborted) {
    const response = await until(signal, fetch(input.url, { signal }));
    yield await until(signal, response.text());
    await Time.sleep(input.ms, signal);
  }
}

export default function Status(): JSX.Element {
  let status = '';

  function show(text: string) {
    status = text;
  }

  return (
    <p>
      <Subscribe to={poll} input={{ url: '/status', ms: 5000 }} on:value={show} />
      {status}
    </p>
  );
}
```

A source needs no server. This one counts down and ends, which stops the subscription:

```tsx live
import { Subscribe, Time } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

async function* countdown(input: { from: number; ms: number }, signal: AbortSignal) {
  for (let n = input.from; n >= 0; n -= 1) {
    yield n;
    await Time.sleep(input.ms, signal);
  }
}

export default function Launch(): JSX.Element {
  let left = 10;

  function tick(n: number) {
    left = n;
  }

  return (
    <p>
      <Subscribe to={countdown} input={{ from: 10, ms: 1000 }} on:value={tick} />
      {left === 0 ? 'Liftoff' : `${left} s`}
    </p>
  );
}
```

A source that ignores its signal keeps its socket or timer open after the block is removed. Dev builds warn in the console when the generator has not finished 1000 ms after the stop.

## Delivery

Delivery is pull-based. The loader asks the source for its next value only after the message of the previous value has patched the page. Each subscription has one value in flight, and the source decides what to drop. The stock sources keep the latest value or a buffer of 100.

Each value is an ordinary message with the value as its payload, so it goes through the same queue as clicks.

## Server, resume and unmount

- **Server.** The server never runs a source. For each `<Subscribe>` in the rendered view it writes a marker: `<template i-sub="timer" i-input="1000" i-key="1000" on:value="$e0">`, where `$e0` is the function of the handler call, which receives each value. The input and the key are written with `JSON.stringify`, so they must be JSON values. A stopped subscription, one whose condition is false, writes no marker.
- **Resume.** The loader starts the sources whose markers are in the page, with no event needed. The source lives in its own `source=<name>` chunk, which loads at start. A page without `<Subscribe>` loads nothing for subscriptions.
- **Add and remove.** When a patch adds a block with a `<Subscribe>`, its source starts. A `<Subscribe>` in a `<For>` row starts and stops with its row.
- **Unmount.** When the block is removed, the runtime aborts the signal and calls the generator's `return()` without waiting for it. It drops any value yielded after that. No handler runs for a subscription that is gone.
- **Errors.** A source that throws ends, and the loader reports the error in the console. When the handler chunk for a value fails to load, the next value tries the load again.

The feature adds about 940 B gzip to the loader, only in apps that use `<Subscribe>`.

## Common errors

| Rule id               | Cause                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `subscribe-source`    | `to` is not an imported or module-level async generator function. |
| `subscribe-input-key` | `input` reads a state path that `key` does not read.              |
| `subscribe-children`  | `<Subscribe>` has children.                                       |
