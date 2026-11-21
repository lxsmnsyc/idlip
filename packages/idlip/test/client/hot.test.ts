import { describe, expect, it } from 'vitest';
import { connectHot, mergeModel } from '../../src/client/hot.ts';
import type { HotMessage } from '../../src/client/hot.ts';

describe('mergeModel', () => {
  it('keeps current values, adds new fields and drops removed ones', () => {
    expect(mergeModel({ a: 1, b: 2 }, { a: 5, c: 9 })).toEqual({ a: 5, b: 2 });
  });
});

describe('connectHot', () => {
  it('imports a stamped URL for the chunks of a swap, and no other', async () => {
    let listener: ((message: HotMessage) => void) | undefined;
    const hot = connectHot(
      {
        on(_event, next) {
          listener = next;
        },
      },
      {
        boot: [],
        roots: new Map(),
        createRoot: () => {
          throw new Error('unused');
        },
        patch: async () => {},
        settled: async () => {},
        report: (error) => {
          throw error;
        },
      },
    );
    expect(hot.phase()).toBe('idle');
    expect(hot.rewrite('/a?x')).toBe('/a?x');
    listener?.({ module: '/m', kind: 'swap', chunks: ['/a?x'], timestamp: 5 });
    await Promise.resolve();
    await Promise.resolve();
    expect(hot.phase()).toBe('swapped');
    expect(hot.rewrite('/a?x')).toBe('/a?x&t=5');
    expect(hot.rewrite('/b?x')).toBe('/b?x');
  });
});
