// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  vi.restoreAllMocks();
});

const PANEL = `
export default function App() {
  let open = true;
  let keys = 0;
  function toggle() {
    open = !open;
  }
  function press() {
    keys = keys + 1;
  }
  return (
    <div>
      <button on:click={toggle}>toggle</button>
      {open && <window on:keydown={press} />}
      <output>{keys}</output>
    </div>
  );
}
`;

const MOVE = `
export default function App() {
  let moves = '';
  let typed = '';
  function move(x: number) {
    moves = moves + x + ',';
  }
  function type(value: string) {
    typed = typed + value + ',';
  }
  return (
    <div>
      <window latest:pointermove={(e) => move(e.clientX)} />
      <input on:input={(e) => type(e.currentTarget.value)} />
      <output id="moves">{moves}</output>
      <output id="typed">{typed}</output>
    </div>
  );
}
`;

const LIST = `
export default function App() {
  let count = 0;
  function bump() {
    count = count + 1;
  }
  return (
    <div>
      <button on:click={bump}>bump</button>
      <output>{count}</output>
    </div>
  );
}
`;

function pointer(x: number): void {
  const event = new Event('pointermove');
  Object.defineProperty(event, 'clientX', { value: x });
  window.dispatchEvent(event);
}

describe('window events', () => {
  it('stops getting keydown after the branch is removed', async () => {
    page = await mount(PANEL, {});
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await page.settled();
    expect(page.text('output')).toBe('1');
    page.click('button');
    await page.settled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await page.settled();
    expect(page.text('output')).toBe('1');
    // The branch comes back and the window listens again.
    page.click('button');
    await page.settled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await page.settled();
    expect(page.text('output')).toBe('2');
  });
});

describe('latest', () => {
  it('delivers only the last event of a burst, and every queued input', async () => {
    page = await mount(MOVE, {}, { check: false });
    // The chunks are still loading, so the burst waits in the queue.
    pointer(1);
    pointer(2);
    pointer(3);
    page.input('input', 'a');
    page.input('input', 'ab');
    await page.settled();
    expect(page.text('#moves')).toBe('3,');
    // An event function reads the element when it runs, so both queued inputs see the last value.
    expect(page.text('#typed')).toBe('ab,ab,');
  });
});

describe('deep queues', () => {
  async function click(times: number): Promise<void> {
    for (let count = 0; count < times; count++) {
      page!.click('button');
    }
    await page!.settled();
  }

  it('warns once and names the event at 20 queued events', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(LIST, {});
    await click(25);
    expect(page.text('output')).toBe('25');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('"click"');
  });

  it('does not warn below 20 events', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page = await mount(LIST, {});
    await click(19);
    expect(warn).not.toHaveBeenCalled();
  });
});
