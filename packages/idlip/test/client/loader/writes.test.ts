// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion
import { afterEach, describe, expect, it } from 'vitest';
import { getLoaded, reached, release, setup, until } from './helpers.ts';
import type { Harness } from './helpers.ts';
import type { PageState } from '../../../src/core/format.ts';

let harness: Harness | undefined;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function toggle(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[type=checkbox]')!;
}

/** Changes the state of the first record when the loader decodes it. */
function editState(target: Harness, edit: (state: PageState) => void): void {
  const record = target.boot[0] as unknown as [string, () => PageState];
  const read = record[1];
  record[1] = () => {
    const state = read();
    edit(state);
    return state;
  };
}

describe('parallel loading', () => {
  it('starts the binding chunk before the handler chunk resolves', async () => {
    harness = setup('todo', { gated: ['handler=toggle'] });
    harness.start();
    toggle().click();
    await reached('handler=toggle');
    await until(() => getLoaded().includes('binding=todos.*.done'));
    expect(getLoaded()).toEqual(['binding=todos.*.done']);
    expect(harness.patch).not.toHaveBeenCalled();
    release('handler=toggle');
    await harness.settled();
    expect(getLoaded()).toEqual(['binding=todos.*.done', 'handler=toggle']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
  });

  it('loads only the chunks of the write set, not the covered ones', async () => {
    harness = setup('todo');
    harness.start();
    toggle().click();
    await harness.settled();
    expect(getLoaded().toSorted()).toEqual(['binding=todos.*.done', 'handler=toggle']);
  });

  it('reports a failed binding chunk through the patch, not the preload', async () => {
    harness = setup('todo', { broken: ['binding=todos.*.done'] });
    harness.start();
    toggle().click();
    await harness.settled();
    expect(getLoaded()).toEqual(['handler=toggle']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
  });
});

describe('entries without a write set', () => {
  it('loads only the handler chunk when the entry lists no bindings', async () => {
    harness = setup('todo');
    editState(harness, (state) => {
      const handlers = state.manifest.handlers as Record<string, unknown>;
      handlers.toggle = { chunk: 'handler=toggle' };
      handlers.$e3 = { chunk: 'handler=toggle', tags: ['toggle'] };
    });
    harness.start();
    toggle().click();
    await harness.settled();
    expect(getLoaded()).toEqual(['handler=toggle']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
  });
});
