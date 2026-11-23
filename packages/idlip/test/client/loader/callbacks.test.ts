// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const SOURCE = readFileSync(
  join(import.meta.dirname, '../../differential/subjects/callbacks.tsx'),
  'utf8',
);

const PROPS = {
  items: [
    { id: 'a1', label: 'One', picked: true },
    { id: 'a2', label: 'Two', picked: false },
  ],
};

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

function button(index: number): HTMLElement {
  const found = page!.root.querySelectorAll('button')[index];
  if (!(found instanceof HTMLElement)) {
    throw new Error(`No button ${index}`);
  }
  return found;
}

function press(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  page!.get('input').dispatchEvent(event);
  return event;
}

describe('event arrows with steps', () => {
  it('writes no payload and no $event into the HTML', () => {
    const { server } = compile(SOURCE, '/src/app.tsx');
    expect(server).not.toContain('$event');
    expect(server).not.toMatch(/on:click='/);
    expect(server).toMatch(/on:keydown="\$e\d+ prevent:ArrowDown prevent:ArrowUp"/);
  });

  it('lists an event function as a handler that names every handler it may send', () => {
    const { manifest } = compile(SOURCE, '/src/app.tsx');
    expect(manifest.handlers.$e2).toMatchObject({ chunk: 'handler=pick', tags: ['pick', 'note'] });
    expect(manifest.handlers.$e2.bindings).toEqual(expect.arrayContaining(['items']));
  });

  it('sends the messages of two calls in order', async () => {
    page = await mount(SOURCE, PROPS);
    // `pick('a2')` then `note('Two')`.
    button(2).click();
    await page.settled();
    expect(page.text('p')).toBe('2 picked, Two');
  });

  it('takes the branch that the row picks', async () => {
    page = await mount(SOURCE, PROPS);
    button(3).click();
    await page.settled();
    expect(page.text('p')).toBe('1 picked, kept a2');
    // The first row is picked, so its second button removes it.
    button(1).click();
    await page.settled();
    expect(page.root.querySelectorAll('li')).toHaveLength(1);
  });

  it('reads the row the user clicked, whatever earlier events of the batch removed', async () => {
    page = await mount(SOURCE, PROPS);
    // Both events wait in the queue: the first removes the row above the second.
    button(1).click();
    button(2).click();
    await page.settled();
    expect(page.root.querySelectorAll('li')).toHaveLength(1);
    expect(page.text('p')).toBe('1 picked, Two');
  });

  it('adds an item on Enter with the text of the field, and calls two handlers', async () => {
    page = await mount(SOURCE, PROPS, { check: false });
    const input = page.get('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('Expected an input');
    }
    page.input('input', 'Three');
    await page.settled();
    press('Enter');
    await page.settled();
    expect(page.root.querySelectorAll('li')).toHaveLength(3);
    expect(page.root.querySelectorAll('li')[2]?.textContent).toContain('Three');
    expect(input.value).toBe('');
  });

  it('prevents only the keys of the conditional prevent, and sends every key', async () => {
    page = await mount(SOURCE, PROPS, { check: false });
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    await page.settled();
    expect(page.text('p')).toBe('1 picked, ArrowDown');
    expect(press('a').defaultPrevented).toBe(false);
    await page.settled();
    expect(page.text('p')).toBe('1 picked, a');
  });
});

const GROUP = `
import { For } from 'idlip';
export default function Group(props: { title: string; names: string[] }) {
  let names = props.names;
  let last = '';
  function pick(n: string) { last = n; }
  return (
    <div>
      <b>{last}</b>
      <For each={names} key={(n) => n}>
        {(n) => <button on:click={() => pick(n)}>{n}</button>}
      </For>
    </div>
  );
}`;

const GROUPS = `
import { For } from 'idlip';
import Group from './group.tsx';
export default function App(props: { groups: { id: string; names: string[] }[] }) {
  let groups = props.groups;
  return (
    <main>
      <For each={groups} key={(g) => g.id}>
        {(g) => <Group title={g.id} names={g.names} />}
      </For>
    </main>
  );
}`;

describe('rows of a child in a row of its parent', () => {
  it('reads the rows of the child only, whatever lists the parent has', async () => {
    page = await mount(
      GROUPS,
      {
        groups: [
          { id: 'g1', names: ['a', 'b'] },
          { id: 'g2', names: ['c', 'd'] },
        ],
      },
      { children: { './group.tsx': GROUP }, check: false },
    );
    const buttons = page.root.querySelectorAll('button');
    buttons[3].click();
    await page.settled();
    expect(page.root.querySelectorAll('b')[1]?.textContent).toBe('d');
    expect(page.root.querySelectorAll('b')[0]?.textContent).toBe('');
  });
});
