// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resume } from '../../../src/client/loader/resume.ts';
import { getLoaded, reached, release, setup } from './helpers.ts';
import type { Harness } from './helpers.ts';

let harness: Harness | undefined;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')];
}

function input(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('counter', () => {
  it('loads only the handler chunk and patches with the old and new model', async () => {
    harness = setup('counter');
    harness.start();
    buttons()[0].click();
    await harness.settled();
    expect(getLoaded()).toEqual(['handler=increment']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
    const [page, prev, next] = harness.patch.mock.calls[0];
    expect(prev).toEqual({ count: 4 });
    expect(next).toEqual({ count: 5 });
    expect(page.manifest.module).toBe('/src/counter.idlip.tsx');
    expect(page.root).toBe(document.body);
  });

  it('does not decode the state before the first event', async () => {
    harness = setup('counter');
    harness.start();
    await harness.settled();
    expect(harness.patch).not.toHaveBeenCalled();
    expect(getLoaded()).toEqual([]);
  });

  it('applies two clicks before the chunk resolves in order', async () => {
    harness = setup('counter', { gated: ['handler=add'] });
    harness.start();
    buttons()[1].click();
    buttons()[1].click();
    await reached('handler=add');
    expect(harness.patch).not.toHaveBeenCalled();
    release('handler=add');
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][1]).toEqual({ count: 4 });
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 24 });
  });

  it('runs several queued messages through update in order and patches once', async () => {
    harness = setup('counter', { gated: ['handler=add'] });
    harness.start();
    buttons()[1].click();
    buttons()[0].click();
    buttons()[1].click();
    await reached('handler=add');
    release('handler=add');
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 25 });
  });

  it('patches again for an event after the first batch', async () => {
    harness = setup('counter');
    harness.start();
    buttons()[0].click();
    await harness.settled();
    buttons()[0].click();
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(2);
    expect(harness.patch.mock.calls[1][1]).toEqual({ count: 5 });
    expect(harness.patch.mock.calls[1][2]).toEqual({ count: 6 });
    expect(getLoaded()).toEqual(['handler=increment']);
  });

  it('takes over events the listener queued before the loader started', async () => {
    harness = setup('counter');
    buttons()[0].click();
    buttons()[0].click();
    expect(harness.boot.q).toHaveLength(2);
    harness.start();
    await harness.settled();
    expect(harness.boot.q).toHaveLength(0);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 6 });
  });

  it('keeps the queued events when a chunk fails, and loads it again on the next event', async () => {
    harness = setup('counter', { broken: ['handler=increment'] });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.start();
    buttons()[0].click();
    await harness.settled();
    expect(errors).toHaveBeenCalled();
    expect(harness.patch).not.toHaveBeenCalled();
    harness.restore('handler=increment');
    buttons()[0].click();
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 6 });
  });
});

describe('bad events', () => {
  it('drops an event with an unknown tag and runs the valid events after it', async () => {
    harness = setup('counter');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.start();
    const stray = document.createElement('i');
    stray.setAttribute('on:click', '["nope",[]]');
    document.querySelector('div')!.append(stray);
    stray.click();
    buttons()[0].click();
    buttons()[0].click();
    await harness.settled();
    expect(errors).toHaveBeenCalled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 6 });
  });

  it('holds later events of a root behind its failed event', async () => {
    harness = setup('counter', { broken: ['handler=add'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.start();
    buttons()[1].click();
    buttons()[0].click();
    buttons()[1].click();
    await harness.settled();
    expect(harness.patch).not.toHaveBeenCalled();
    harness.restore('handler=add');
    buttons()[1].click();
    await harness.settled();
    // add(10), increment, add(10), add(10): in click order, not increment first.
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 35 });
  });

  it('diffs from the rendered model after a failed patch', async () => {
    harness = setup('counter');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.patch.mockRejectedValueOnce(new Error('patch failed'));
    harness.start();
    buttons()[0].click();
    await harness.settled();
    buttons()[0].click();
    await harness.settled();
    expect(harness.patch.mock.calls[1][1]).toEqual({ count: 4 });
    expect(harness.patch.mock.calls[1][2]).toEqual({ count: 6 });
  });

  it('warns once when the listener is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resume([], async () => {});
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('todo', () => {
  function field(): HTMLInputElement {
    return document.querySelector<HTMLInputElement>('input:not([type])')!;
  }

  it('decodes an event path placeholder from an input event', async () => {
    harness = setup('todo');
    harness.start();
    input(field(), 'milk');
    await harness.settled();
    // The binding chunk of the write set starts with the handler chunk.
    expect(getLoaded().toSorted()).toEqual(['binding=draft', 'handler=setDraft']);
    expect(harness.patch.mock.calls[0][2]).toMatchObject({ draft: 'milk' });
  });

  it('resolves placeholders when the event fires, not when the chunk loads', async () => {
    harness = setup('todo', { gated: ['handler=setDraft'] });
    harness.start();
    const messages: unknown[] = [];
    const push = harness.boot.q!.push;
    harness.boot.q!.push = (...events) => {
      for (const event of events) {
        messages.push(event.message);
      }
      return push(...events);
    };
    input(field(), 'a');
    input(field(), 'ab');
    input(field(), 'abc');
    await reached('handler=setDraft');
    expect(messages).toEqual([
      { t: 'setDraft', p: ['a'] },
      { t: 'setDraft', p: ['ab'] },
      { t: 'setDraft', p: ['abc'] },
    ]);
    release('handler=setDraft');
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toMatchObject({ draft: 'abc' });
  });

  it('applies prevent before the chunk loads, so a submit does not navigate', () => {
    harness = setup('todo', { gated: ['handler=add'] });
    harness.start();
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    document.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('queues a message for a key filter only when the key matches', async () => {
    harness = setup('todo');
    harness.start();
    input(field(), 'x');
    await harness.settled();
    field().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(1);
    field().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    await harness.settled();
    expect(harness.patch).toHaveBeenCalledTimes(2);
    expect(harness.patch.mock.calls[1][1]).toMatchObject({ draft: 'x' });
    expect(harness.patch.mock.calls[1][2]).toMatchObject({ draft: '' });
  });

  it('toggles a todo with the chunks of toggle and its write set only', async () => {
    harness = setup('todo');
    harness.start();
    document.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await harness.settled();
    expect(getLoaded().toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle']);
    const [, prev, next] = harness.patch.mock.calls[0];
    expect((prev.todos as { done: boolean }[])[0].done).toBe(true);
    expect((next.todos as { done: boolean }[])[0].done).toBe(false);
  });
});
