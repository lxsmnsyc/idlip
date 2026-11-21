// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isComment } from '../../../src/client/patch/guards.ts';
import { getLoaded, setup } from './harness.ts';
import type { Harness } from './harness.ts';

let harness: Harness | undefined;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function getButtons(label: string): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter((b) => b.textContent === label);
}

function getCounts(): string[] {
  return [...document.querySelectorAll('output')].map((o) => o.textContent);
}

describe('nested board', () => {
  it('runs a child click on its own slot and loads only the child chunks', async () => {
    harness = setup();
    getButtons('+')[1].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '1', '0']);
    expect(getLoaded().toSorted()).toEqual(['counter:binding=count', 'counter:handler=increment']);
    expect(harness.errors).toEqual([]);
  });

  it('keeps the state of each slot apart', async () => {
    harness = setup();
    getButtons('+')[0].click();
    getButtons('+')[0].click();
    getButtons('+')[2].click();
    await harness.settled();
    expect(getCounts()).toEqual(['2', '0', '1']);
  });

  it('runs the parent remove for a message prop and drops the slot', async () => {
    harness = setup();
    getButtons('+')[1].click();
    await harness.settled();
    getButtons('Remove')[1].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0']);
    expect(document.querySelector('p')?.textContent).toBe('1 counters');
    expect(harness.errors).toEqual([]);
  });

  it('drops a message for a slot that left the page', async () => {
    harness = setup();
    const gone = getButtons('+')[1];
    getButtons('Remove')[1].click();
    await harness.settled();
    expect(harness.errors).toEqual([]);
    expect(getCounts()).toEqual(['0', '0']);
    gone.click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0']);
    expect(harness.errors).toEqual([]);
  });

  it('runs a message prop that has no paths on the parent', async () => {
    harness = setup();
    getButtons('Remove')[0].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0']);
    expect(harness.errors).toEqual([]);
  });

  it('patches the props binding of a child when the parent passes a new prop', async () => {
    harness = setup();
    getButtons('+')[2].click();
    await harness.settled();
    getLoaded().length = 0;
    harness.send('relabel', ['a2', 'Renamed']);
    await harness.settled();
    const labels = [...document.querySelectorAll('span')].map((s) => s.textContent);
    expect(labels).toEqual(['Spare', 'First', 'Renamed']);
    // The child's own state stays.
    expect(getCounts()).toEqual(['0', '0', '1']);
    expect(getLoaded()).toContain('counter:binding=props.label');
    expect(getLoaded()).not.toContain('counter:binding=count');
    expect(harness.errors).toEqual([]);
  });

  it('runs the child init for a client-added row and then its handlers', async () => {
    harness = setup();
    harness.send('add', ['a3', 'Third']);
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0', '0', '0']);
    expect(getLoaded()).toContain('counter:view');
    getButtons('+')[3].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0', '0', '1']);
    getButtons('Remove')[3].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0', '0']);
    expect(harness.errors).toEqual([]);
  });

  it('keeps the slots when rows move', async () => {
    harness = setup();
    getButtons('+')[2].click();
    await harness.settled();
    harness.send('reverse', []);
    await harness.settled();
    const labels = [...document.querySelectorAll('span')].map((s) => s.textContent);
    expect(labels).toEqual(['Spare', 'Second', 'First']);
    expect(getCounts()).toEqual(['0', '1', '0']);
    getButtons('+')[1].click();
    await harness.settled();
    expect(getCounts()).toEqual(['0', '2', '0']);
    expect(harness.errors).toEqual([]);
  });

  it('starts a row that returns under the same key from its props', async () => {
    harness = setup();
    getButtons('+')[2].click();
    await harness.settled();
    getButtons('Remove')[2].click();
    await harness.settled();
    harness.send('add', ['a2', 'Again']);
    await harness.settled();
    expect(getCounts()).toEqual(['0', '0', '0']);
    expect([...document.querySelectorAll('span')].map((s) => s.textContent)).toEqual([
      'Spare',
      'First',
      'Again',
    ]);
  });

  it('skips the patch of a child whose boundary is gone and leaves the root alone', async () => {
    harness = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Drop the boundary comments of the last child, as a foreign script could.
    const walker = document.createTreeWalker(document.body, 128);
    const comments: Comment[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (isComment(node)) {
        comments.push(node);
      }
    }
    for (const comment of comments) {
      if (comment.data === 'n:1:a2') {
        comment.remove();
      }
    }
    harness.send('relabel', ['a2', 'Renamed']);
    await harness.settled();
    // The child's `t0` is not applied to the `t0` of the root.
    expect(document.querySelector('p')?.textContent).toBe('2 counters');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1:a2'));
    expect(harness.errors).toEqual([]);
  });
});
