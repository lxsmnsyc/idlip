import { describe, expect, it } from 'vitest';
import { diffPaths } from '../../../src/client/patch/diff.ts';

describe('diffPaths on the length of a string', () => {
  it('sees a top-level string change its length', () => {
    const changed = diffPaths({ draft: 'ab' }, { draft: 'abc' }, ['draft.length'], {});
    expect([...changed]).toEqual(['draft.length']);
  });

  it('sees no change when the length stays', () => {
    expect(diffPaths({ draft: 'ab' }, { draft: 'cd' }, ['draft.length'], {}).size).toBe(0);
  });

  it('sees a row label change its length, by index and by key', () => {
    const before = { rows: [{ id: 'a', label: 'one' }] };
    const after = { rows: [{ id: 'a', label: 'three' }] };
    for (const keys of [{}, { rows: 'id' }]) {
      const changed = diffPaths(before, after, ['rows.*.label.length'], keys);
      expect([...changed]).toEqual(['rows.*.label.length']);
    }
  });

  it('keeps reading the length of an array', () => {
    const changed = diffPaths({ tags: ['a'] }, { tags: ['a', 'b'] }, ['tags.length'], {});
    expect(changed.size).toBe(1);
  });
});
