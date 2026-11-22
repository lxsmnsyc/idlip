// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';
import { getLoaded, setup } from '../loader/helpers.ts';
import type { Harness } from '../loader/helpers.ts';

let page: MountedPage | undefined;
let harness: Harness | undefined;
interface Detail {
  readonly error: unknown;
  readonly path: string;
}

const events: CustomEvent<Detail>[] = [];

function listen(event: Event): void {
  events.push(event as CustomEvent<Detail>);
}

document.addEventListener('idlip:error', listen);

afterEach(() => {
  page?.stop();
  page = undefined;
  harness?.cleanup();
  harness = undefined;
  events.length = 0;
});

const COUNTER = `
import { Try } from 'idlip';

function check(n: number): number {
  if (n > 1) {
    throw new Error('too big ' + n);
  }
  return n;
}

export default function App() {
  let n = 0;
  let other = 0;
  function inc(): void {
    n = n + 1;
  }
  function dec(): void {
    n = n - 1;
  }
  function bump(): void {
    other = other + 1;
  }
  return (
    <main>
      <Try catch={(error, reset) => <p>{error}<button on:click={reset}>retry</button></p>}>
        <span>{check(n)}</span>
      </Try>
      <b>{other}</b>
      <button on:click={inc}>inc</button>
      <button on:click={dec}>dec</button>
      <button on:click={bump}>bump</button>
    </main>
  );
}
`;

const ROWS = `
import { For, Try } from 'idlip';

function check(n: number): number {
  if (n > 1) {
    throw new Error('too big ' + n);
  }
  return n;
}

export default function App() {
  let items = [{ id: 1, n: 0 }, { id: 2, n: 0 }];
  function raise(id: number): void {
    items = items.map((item) => (item.id === id ? { ...item, n: item.n + 2 } : item));
  }
  function lower(id: number): void {
    items = items.map((item) => (item.id === id ? { ...item, n: 0 } : item));
  }
  return (
    <ul>
      <For each={items} key={(item) => item.id}>
        {(item) => (
          <li>
            <Try catch={(error, reset) => <button on:click={reset}>{error}</button>}>
              <span>{check(item.n)}</span>
            </Try>
            <i on:click={() => raise(item.id)}>raise</i>
            <u on:click={() => lower(item.id)}>lower</u>
          </li>
        )}
      </For>
    </ul>
  );
}
`;

const THROWING = `
export default function App() {
  let n = 0;
  function inc(): void {
    if (n >= 0) {
      throw new Error('handler failed');
    }
    n = n + 1;
  }
  return <button on:click={inc}>{n}</button>;
}
`;

async function mountPage(source: string, expectCaught = true): Promise<MountedPage> {
  page = await mount(source, {}, { check: false, expectCaught });
  return page;
}

describe('a throwing binding', () => {
  it('swaps the region to its catch view and keeps the rest of the page', async () => {
    const view = await mountPage(COUNTER);
    view.click('main > button:nth-of-type(1)');
    await view.settled();
    view.click('main > button:nth-of-type(1)');
    await view.settled();
    expect(view.root.innerHTML).toContain('<!--e0:1-->');
    expect(view.text('p')).toContain('Error: too big 2');
    expect(view.root.querySelector('span')).toBeNull();
    // Bindings outside the region still run.
    view.click('main > button:nth-of-type(3)');
    await view.settled();
    expect(view.text('b')).toBe('1');
    expect(events).toHaveLength(1);
    expect(events[0].detail.error).toBeInstanceOf(Error);
  });

  it('reset renders the body again from the current model', async () => {
    const view = await mountPage(COUNTER);
    view.click('main > button:nth-of-type(1)');
    await view.settled();
    view.click('main > button:nth-of-type(1)');
    await view.settled();
    // The model is unchanged, so the body throws again and shows the catch view.
    view.click('p button');
    await view.settled();
    expect(view.root.innerHTML).toContain('<!--e0:1-->');
    // After the model changes, the next reset renders the body.
    view.click('main > button:nth-of-type(2)');
    await view.settled();
    view.click('p button');
    await view.settled();
    expect(view.root.innerHTML).toContain('<!--e0:0--><span i-a="0">');
    expect(view.text('span')).toBe('1');
    // The bindings of the new body work.
    view.click('main > button:nth-of-type(2)');
    await view.settled();
    expect(view.text('span')).toBe('0');
  });
});

describe('settled', () => {
  it('throws the error that a region caught unless expectCaught is set', async () => {
    const view = await mountPage(COUNTER, false);
    view.click('main > button:nth-of-type(1)');
    await view.settled();
    view.click('main > button:nth-of-type(1)');
    await expect(view.settled()).rejects.toThrow('too big 2');
  });
});

describe('a throwing binding in a row', () => {
  it('swaps only that row and resets it from its item', async () => {
    const view = await mountPage(ROWS);
    view.click('li:nth-child(2) i');
    await view.settled();
    const rows = view.root.querySelectorAll('li');
    expect(rows[0].querySelector('span')?.textContent).toBe('0');
    expect(rows[1].textContent).toContain('Error: too big 2');
    view.click('li:nth-child(2) u');
    await view.settled();
    // The row is in the catch state: its button resets it with the row's own item.
    view.click('li:nth-child(2) button');
    await view.settled();
    expect(view.root.querySelectorAll('li')[1].querySelector('span')?.textContent).toBe('0');
  });
});

const SVG = `
import { Try } from 'idlip';

function check(n: number): number {
  if (n > 1) {
    throw new Error('too big ' + n);
  }
  return n;
}

export default function App() {
  let n = 0;
  function inc(): void {
    n = n + 2;
  }
  return (
    <main>
      <svg>
        <Try catch={(error) => <text>{error}</text>}>
          <circle r={check(n)} />
        </Try>
      </svg>
      <button on:click={inc}>inc</button>
    </main>
  );
}
`;

describe('a region inside svg', () => {
  it('renders the catch view in the svg namespace', async () => {
    const view = await mountPage(SVG);
    view.click('button');
    await view.settled();
    expect(view.get('text').namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

describe('a throwing handler', () => {
  it('keeps the model and fires idlip:error once', async () => {
    const view = await mountPage(THROWING);
    view.click('button');
    try {
      await view.settled();
    } catch {
      // `settled` rethrows the reported error.
    }
    expect(view.text('button')).toBe('0');
    expect(events).toHaveLength(1);
    expect((events[0].detail.error as Error).message).toBe('handler failed');
  });
});

describe('a chunk that fails to load', () => {
  function breakChunk(chunk: string, times: number): void {
    let left = times;
    const broken = (globalThis as unknown as { idlipBroken: string[] }).idlipBroken;
    broken.includes = (name: string): boolean => name === chunk && left-- > 0;
  }

  it('is retried once and then works', async () => {
    harness = setup('counter');
    breakChunk('handler=increment', 1);
    harness.start();
    document.querySelectorAll('button')[0].click();
    await harness.settled();
    // The binding chunk of the write set loads with the handler chunk.
    expect(getLoaded().toSorted()).toEqual(['binding=count', 'handler=increment']);
    expect(harness.patch).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(0);
  });

  it('fires idlip:error once when the retry fails too', async () => {
    harness = setup('counter');
    breakChunk('handler=increment', 2);
    harness.start();
    document.querySelectorAll('button')[0].click();
    await harness.settled();
    expect(harness.patch).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect((events[0].detail.error as Error).message).toBe('chunk failed');
  });
});
