// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { getChunkId } from '../../../src/core/format.ts';
import { getLoaded, setup, until } from './helpers.ts';
import type { Harness } from './helpers.ts';

let harness: Harness | undefined;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
  for (const link of document.head.querySelectorAll('link')) {
    link.remove();
  }
});

/** Adds a modulepreload link for each chunk, with the URL the state script maps it to. */
function addPreloads(chunks: readonly string[]): void {
  const state = harness!.boot[0][1]();
  for (const chunk of chunks) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.setAttribute('href', state.chunks[getChunkId(state.manifest.module, chunk)]);
    document.head.append(link);
  }
}

describe('preimport', () => {
  it('imports the preloaded chunks after load, so the first click imports nothing more', async () => {
    harness = setup('counter');
    addPreloads(['handler=increment', 'binding=count']);
    harness.start();
    await harness.settled();
    // Nothing runs before `load`.
    expect(getLoaded()).toEqual([]);

    window.dispatchEvent(new Event('load'));
    await until(() => getLoaded().length === 2);
    expect(getLoaded().toSorted()).toEqual(['binding=count', 'handler=increment']);

    document.querySelector('button')!.click();
    await harness.settled();
    expect(getLoaded()).toHaveLength(2);
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(harness.patch.mock.calls[0][2]).toEqual({ count: 5 });
  });
});
