// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { startSubs } from '../../../src/client/subs/index.ts';
import type { QueuedEvent } from '../../../src/core/format.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('stops without awaiting return(), drops later yields and warns after 1000 ms', async () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.innerHTML = `<template i-sub="stuck" on:value='["t",[["$event"]]]'></template>`;
  const pushed: QueuedEvent[] = [];
  let signal: AbortSignal | undefined;
  let release: ((step: IteratorResult<number>) => void) | undefined;
  const iterator: AsyncIterator<number> = {
    // Waits for a value that comes after the abort, and `return()` never settles.
    next: async () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    return: async () => {
      await new Promise(() => {});
      return { done: true, value: undefined };
    },
  };
  const stop = startSubs({
    // oxlint-disable-next-line typescript/promise-function-async
    load: () =>
      Promise.resolve({
        source(_input: unknown, given: AbortSignal) {
          signal = given;
          return { [Symbol.asyncIterator]: () => iterator };
        },
      }),
    push(event) {
      pushed.push(event);
    },
    report(error) {
      throw error;
    },
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(signal?.aborted).toBe(false);
  stop();
  expect(signal?.aborted).toBe(true);
  // A value that arrives after the stop reaches no handler.
  release?.({ done: false, value: 1 });
  await vi.advanceTimersByTimeAsync(500);
  expect(warn).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(600);
  expect(pushed).toEqual([]);
  expect(warn).toHaveBeenCalledTimes(1);
});
