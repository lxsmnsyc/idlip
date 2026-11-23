// @vitest-environment happy-dom
// oxlint-disable typescript/no-unsafe-type-assertion
import { afterEach, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

interface Gate {
  log: string[];
  resolve: ((value: number | undefined) => void) | undefined;
  send: (value: number) => void;
}

const scope = globalThis as unknown as { gate?: Gate };

function createGate(): Gate {
  const gate: Gate = {
    log: [],
    resolve: undefined,
    send(value) {
      gate.resolve?.(value);
    },
  };
  scope.gate = gate;
  return gate;
}

/** The 0004 clock: a source that ends when its signal aborts, started by a state union. */
const CLOCK = `
import { Subscribe } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

type ClockState = { state: 'stopped' } | { state: 'running'; ticks: number };

async function* feed(input: number, signal: AbortSignal) {
  const gate = (globalThis as any).gate;
  gate.log.push('start:' + input);
  signal.addEventListener('abort', () => {
    gate.log.push('abort:' + input);
    gate.resolve?.(undefined);
  });
  while (!signal.aborted) {
    const value = await new Promise<number | undefined>((resolve) => {
      gate.resolve = resolve;
    });
    if (signal.aborted) {
      return;
    }
    yield value;
  }
}

export default function Clock(): JSX.Element {
  let clock = { state: 'stopped' } satisfies ClockState as ClockState;
  let seen = 0;
  function start() {
    clock = { state: 'running', ticks: 0 };
  }
  function stop() {
    clock = { state: 'stopped' };
  }
  function tick(value: number) {
    if (clock.state === 'running') {
      clock = { ...clock, ticks: clock.ticks + 1 };
      seen = value;
    }
  }
  return (
    <main>
      <button id="start" on:click={start}>Start</button>
      <button id="stop" on:click={stop}>Stop</button>
      <p id="ticks">{clock.state === 'running' ? clock.ticks : -1}</p>
      <p id="seen">{seen}</p>
      {clock.state === 'running' && <Subscribe to={feed} input={1000} on:value={tick} />}
    </main>
  );
}
`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  scope.gate = undefined;
});

async function wait(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

it('starts, ticks and stops with its block, and no handler runs after', async () => {
  const gate = createGate();
  page = await mount(CLOCK, {});
  expect(gate.log).toEqual([]);
  page.click('#start');
  await page.settled();
  await wait();
  expect(gate.log).toEqual(['start:1000']);
  gate.send(7);
  await wait();
  await page.settled();
  expect(page.text('#ticks')).toBe('1');
  expect(page.text('#seen')).toBe('7');
  page.click('#stop');
  await page.settled();
  await wait();
  expect(gate.log).toEqual(['start:1000', 'abort:1000']);
  gate.send(9);
  await wait();
  await page.settled();
  expect(page.text('#seen')).toBe('7');
  expect(page.text('#ticks')).toBe('-1');
});

it('resumes a running page and ticks without an event', async () => {
  const gate = createGate();
  const running = CLOCK.replace(
    "let clock = { state: 'stopped' } satisfies",
    "let clock = { state: 'running', ticks: 0 } satisfies",
  );
  page = await mount(running, {});
  await wait();
  expect(gate.log).toEqual(['start:1000']);
  gate.send(3);
  await wait();
  await page.settled();
  expect(page.text('#ticks')).toBe('1');
  expect(page.loaded()).toContain('source=feed');
});

it('loads no source chunk for a page without a subscription', async () => {
  createGate();
  const plain = CLOCK.replace(
    "{clock.state === 'running' && <Subscribe to={feed} input={1000} on:value={tick} />}",
    '',
  );
  page = await mount(plain, {});
  page.click('#start');
  await page.settled();
  for (const chunk of page.loaded()) {
    expect(chunk.startsWith('source=')).toBe(false);
  }
});

it('delivers one value at a time, after the previous one patched', async () => {
  const gate = createGate();
  const burst = CLOCK.replace(
    /async function\* feed[\s\S]*?\n}\n\nexport/,
    `async function* feed(input: number, signal: AbortSignal) {
  const gate = (globalThis as any).gate;
  for (let n = 1; n <= 3; n++) {
    yield n;
    gate.log.push('shown:' + document.querySelector('#ticks')!.textContent);
  }
}

export`,
  );
  page = await mount(burst, {});
  page.click('#start');
  await wait();
  await page.settled();
  await wait();
  await page.settled();
  expect(gate.log).toEqual(['shown:1', 'shown:2', 'shown:3']);
  expect(page.text('#ticks')).toBe('3');
});

const KEYED = `
import { For, Subscribe } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

async function* feed(input: string, signal: AbortSignal) {
  const gate = (globalThis as any).gate;
  gate.log.push('start:' + input);
  signal.addEventListener('abort', () => {
    gate.log.push('abort:' + input);
    gate.resolve?.(undefined);
  });
  while (!signal.aborted) {
    const value = await new Promise<number | undefined>((resolve) => {
      gate.resolve = resolve;
    });
    if (signal.aborted) {
      return;
    }
    yield value;
  }
}

interface Row { id: string }

export default function Keyed(): JSX.Element {
  let room = 'a';
  let items = [{ id: "x" }, { id: "y" }] satisfies Row[] as Row[];
  let count = 0;
  function move() {
    room = 'b';
  }
  function drop() {
    items = items.slice(1);
  }
  function add() {
    items = [...items, { id: 'z' }];
  }
  function tick(value: number) {
    count = count + 1;
  }
  return (
    <main>
      <button id="move" on:click={move}>Move</button>
      <button id="drop" on:click={drop}>Drop</button>
      <button id="add" on:click={add}>Add</button>
      <p id="count">{count}</p>
      <Subscribe key={room} to={feed} input={room} on:value={tick} />
      <For each={items} key={(row) => row.id}>
        {(row) => (
          <li>
            <Subscribe key={row.id} to={feed} input={row.id} on:value={tick} />
          </li>
        )}
      </For>
    </main>
  );
}
`;

it('restarts on a new key, and starts and stops rows on their own', async () => {
  const gate = createGate();
  page = await mount(KEYED, {});
  await wait();
  expect([...gate.log].toSorted()).toEqual(['start:a', 'start:x', 'start:y']);
  gate.log.length = 0;
  page.click('#move');
  await page.settled();
  await wait();
  expect(gate.log).toEqual(['abort:a', 'start:b']);
  gate.log.length = 0;
  page.click('#drop');
  await page.settled();
  await wait();
  expect(gate.log).toEqual(['abort:x']);
  gate.log.length = 0;
  page.click('#add');
  await page.settled();
  await wait();
  expect(gate.log).toEqual(['start:z']);
});
