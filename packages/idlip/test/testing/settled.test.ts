// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { resume } from '../../src/client/loader/resume.ts';
import { getLoaded, release, setup } from '../client/loader/helpers.ts';
import type { Harness } from '../client/loader/helpers.ts';

let harness: Harness | undefined;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

describe('resume().settled', () => {
  it('resolves at once when nothing waits', async () => {
    harness = setup('counter');
    const { settled } = resume(harness.boot, harness.patch);
    await settled();
    expect(harness.patch).not.toHaveBeenCalled();
  });

  it('waits for a chunk load and the patch', async () => {
    harness = setup('counter', { gated: ['handler=add'] });
    const { settled } = resume(harness.boot, harness.patch);
    document.querySelectorAll('button')[1].click();
    let done = false;
    const waiting = settled().then(() => {
      done = true;
    });
    await tick();
    expect(done).toBe(false);
    release('handler=add');
    await waiting;
    expect(getLoaded()).toEqual(['handler=add']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
  });

  it('resolves after stop and patches nothing', async () => {
    harness = setup('counter');
    const { settled, stop } = resume(harness.boot, harness.patch);
    document.querySelectorAll('button')[1].click();
    const waiting = settled();
    stop();
    await waiting;
    expect(harness.patch).not.toHaveBeenCalled();
  });
});
