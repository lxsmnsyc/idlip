import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeChart {
  classList: { add: (name: string) => void };
  added: string[];
}

function makeChart(): FakeChart {
  const added: string[] = [];
  return { added, classList: { add: (name) => added.push(name) } };
}

type Callback = (entries: { isIntersecting: boolean }[]) => void;

/** Loads `chart.ts` against a fake document and, if asked, a fake IntersectionObserver. */
async function load(chart: FakeChart | null, observer: boolean): Promise<Callback[]> {
  const callbacks: Callback[] = [];
  const window: Record<string, unknown> = {};
  if (observer) {
    window.IntersectionObserver = class {
      constructor(callback: Callback) {
        callbacks.push(callback);
      }
      observe(): void {}
      disconnect(): void {}
    };
  }
  vi.stubGlobal('window', window);
  vi.stubGlobal('IntersectionObserver', window.IntersectionObserver);
  vi.stubGlobal('document', { querySelector: () => chart });
  vi.resetModules();
  await import('../src/client/chart.ts');
  return callbacks;
}

describe('the chart script', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds is-in only when the chart intersects', async () => {
    const chart = makeChart();
    const callbacks = await load(chart, true);
    expect(chart.added).toEqual([]);
    callbacks[0]([{ isIntersecting: false }]);
    expect(chart.added).toEqual([]);
    callbacks[0]([{ isIntersecting: true }]);
    expect(chart.added).toEqual(['is-in']);
  });

  it('shows the end state at once without IntersectionObserver', async () => {
    const chart = makeChart();
    await load(chart, false);
    expect(chart.added).toEqual(['is-in']);
  });

  it('does nothing on a page without the chart', async () => {
    const callbacks = await load(null, true);
    expect(callbacks).toEqual([]);
  });
});
