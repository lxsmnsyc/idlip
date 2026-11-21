import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Random, Time, eventSource, media, socket, timer, until } from '../../src/index.ts';

type Listener = (event: unknown) => void;

class FakeTarget {
  listeners = new Map<string, Listener[]>();
  closed = false;
  addEventListener(name: string, listener: Listener): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  removeEventListener(name: string, listener: Listener): void {
    this.listeners.set(
      name,
      (this.listeners.get(name) ?? []).filter((item) => item !== listener),
    );
  }
  emit(name: string, event: unknown): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
  }
  close(): void {
    this.closed = true;
  }
}

let last: FakeTarget | undefined;

class FakeSocket extends FakeTarget {
  constructor(public url: string) {
    super();
    last = this;
  }
}

class FakeEventSource extends FakeSocket {
  static CLOSED = 2;
  readyState = 1;
}

function target(): FakeTarget {
  if (last === undefined) {
    throw new Error('no fake created');
  }
  return last;
}

class FakeMedia extends FakeTarget {
  matches = true;
}

function noop(): void {}

async function tick(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function take(source: AsyncGenerator<string, void, undefined>): Promise<string> {
  const result = await source.next();
  if (result.done === true) {
    throw new Error('source ended');
  }
  return result.value;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  last = undefined;
});

describe('until and sleep', () => {
  it('until resolves with the promise value', async () => {
    const controller = new AbortController();
    expect(await until(controller.signal, Promise.resolve(3))).toBe(3);
  });

  it('until rejects on abort and on an aborted signal', async () => {
    const controller = new AbortController();
    const pending = until(controller.signal, new Promise<number>(() => {}));
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
    await expect(until(controller.signal, Promise.resolve(1))).rejects.toThrow('stop');
  });

  it('sleep rejects on abort and on an aborted signal', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = Time.sleep(1000, controller.signal);
    const caught = expect(pending).rejects.toThrow('stop');
    controller.abort(new Error('stop'));
    await caught;
    expect(vi.getTimerCount()).toBe(0);
    await expect(Time.sleep(10, controller.signal)).rejects.toThrow('stop');
  });

  it('sleep resolves after the delay', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const pending = Time.sleep(50).then(done);
    await vi.advanceTimersByTimeAsync(49);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toHaveBeenCalled();
  });
});

describe('Time and Random', () => {
  it('returns promises of the right values', async () => {
    expect(typeof (await Time.now())).toBe('number');
    expect(await Random.id()).toMatch(/^[0-9a-f-]{36}$/);
    const value = await Random.number();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('timer', () => {
  it('yields only the latest tick when pulled slowly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new AbortController();
    const source = timer(100, controller.signal);
    const first = source.next();
    await vi.advanceTimersByTimeAsync(100);
    expect((await first).value).toBe(100);
    await vi.advanceTimersByTimeAsync(350);
    const second = await source.next();
    expect(second.value).toBe(400);
    controller.abort();
  });

  it('closes within one task after abort and clears the interval', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const source = timer(100, controller.signal);
    const pending = source.next();
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toEqual({ done: true, value: undefined });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends when return() is not awaited', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const source = timer(100, controller.signal);
    const pending = source.next();
    controller.abort();
    source.return(undefined).catch(noop);
    await vi.advanceTimersByTimeAsync(0);
    expect((await pending).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('socket', () => {
  it('buffers 100 messages and drops the oldest', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const controller = new AbortController();
    const source = socket('ws://x', controller.signal);
    const first = take(source);
    await tick();
    for (let i = 0; i < 150; i++) {
      target().emit('message', { data: `m${i}` });
    }
    // The read woke after all 150 pushes, so it gets the oldest of the last 100.
    const received = [await first];
    for (let i = 1; i < 100; i++) {
      received.push(await take(source));
    }
    expect(received[0]).toBe('m50');
    expect(received[99]).toBe('m149');
    controller.abort();
  });

  it('closes within one task after abort', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const controller = new AbortController();
    const source = socket({ url: 'ws://x' }, controller.signal);
    const pending = source.next();
    await tick();
    controller.abort();
    source.return(undefined).catch(noop);
    expect((await pending).done).toBe(true);
    expect(target().closed).toBe(true);
  });

  it('ends on close and throws on error', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const source = socket('ws://x', new AbortController().signal);
    const pending = source.next();
    await tick();
    target().emit('close', {});
    expect((await pending).done).toBe(true);
    const failing = socket('ws://y', new AbortController().signal);
    const caught = expect(failing.next()).rejects.toThrow('WebSocket error');
    await tick();
    target().emit('error', {});
    await caught;
  });

  it('does not start when the signal is already aborted', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const controller = new AbortController();
    controller.abort();
    expect((await socket('ws://x', controller.signal).next()).done).toBe(true);
    expect(last).toBeUndefined();
  });
});

describe('eventSource', () => {
  it('yields data and closes within one task after abort', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'MessageEvent',
      class {
        data: string;
        constructor(
          public type: string,
          init: { data: string },
        ) {
          this.data = init.data;
        }
      },
    );
    const controller = new AbortController();
    const source = eventSource({ url: '/events', event: 'tick' }, controller.signal);
    const first = source.next();
    await tick();
    target().emit('tick', new MessageEvent('tick', { data: 'a' }));
    expect((await first).value).toBe('a');
    const pending = source.next();
    controller.abort();
    source.return(undefined).catch(noop);
    expect((await pending).done).toBe(true);
    expect(target().closed).toBe(true);
  });
});

describe('media', () => {
  it('yields the current value first, typed as boolean', async () => {
    const list = new FakeMedia();
    vi.stubGlobal('matchMedia', () => list);
    const controller = new AbortController();
    const source = media('(prefers-color-scheme: dark)', controller.signal);
    const first = await source.next();
    expect(first.value).toBe(true);
    expectTypeOf(source).toEqualTypeOf<AsyncGenerator<boolean, void, undefined>>();
    const next = source.next();
    list.emit('change', { matches: false });
    expect((await next).value).toBe(false);
    const pending = source.next();
    controller.abort();
    source.return(undefined).catch(noop);
    expect((await pending).done).toBe(true);
    expect(list.listeners.get('change')).toEqual([]);
  });
});
