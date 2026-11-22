// @vitest-environment happy-dom
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/promise-function-async
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const SOURCE = `
import { Dom, For, Random } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Refs(props: { start: string }): JSX.Element {
  let items = [{ id: 'a1', text: props.start }];
  let size = '';

  function focusSearch() {
    Dom.focus('search');
  }
  function addAndFocus() {
    items = [...items, { id: 'a2', text: 'two' }];
    Dom.focus(['row', 'a2']);
  }
  function missing() {
    Dom.focus('nope');
  }
  function clear() {
    Dom.reset('form');
  }
  async function measure() {
    const box = await Dom.measure('search');
    size = box === null ? '' : box.width + 'x' + box.height;
  }
  async function measureMissing() {
    const box = await Dom.measure('nope');
    size = box === null ? 'none' : 'some';
  }
  async function add() {
    const id = await Random.id();
    items = [...items, { id, text: 'new' }];
  }

  return (
    <main>
      <form ref="form">
        <input ref="search" value="x" />
      </form>
      <button on:click={() => focusSearch()}>focus</button>
      <button on:click={() => addAndFocus()}>add and focus</button>
      <button on:click={() => missing()}>missing</button>
      <button on:click={() => clear()}>clear</button>
      <button on:click={() => measure()}>measure</button>
      <button on:click={() => measureMissing()}>measure missing</button>
      <button on:click={() => add()}>add</button>
      <p>{size}</p>
      <ul>
        <For each={items} key="id">
          {(r) => <li ref={['row', r.id]}>{r.text}</li>}
        </For>
      </ul>
    </main>
  );
}
`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  vi.restoreAllMocks();
});

async function start(): Promise<MountedPage> {
  page = await mount(SOURCE, { start: 'one' });
  return page;
}

function clickButton(mounted: MountedPage, label: string): void {
  for (const button of mounted.root.querySelectorAll('button')) {
    if (button.textContent === label) {
      button.click();
      return;
    }
  }
  throw new Error(`No button ${label}`);
}

describe('refs in the server render', () => {
  it('writes i-ref on elements and on rows', () => {
    const { server } = compile(SOURCE, '/src/app.tsx');
    expect(server).toContain('i-ref="form"');
    expect(server).toContain('i-ref="search"');
    expect(server).toContain("attr$('i-ref', 'row ' + r.id)");
  });

  it('renders a row ref as name and key', async () => {
    const mounted = await start();
    expect(mounted.get('li').getAttribute('i-ref')).toBe('row a1');
    expect(mounted.get('input').getAttribute('i-ref')).toBe('search');
  });

  it('rejects a ref key that is not the key of the For', () => {
    const bad = SOURCE.replace("['row', r.id]", "['row', r.text]");
    const { diagnostics } = compile(bad, '/src/app.tsx');
    expect(diagnostics.map((item) => item.rule)).toContain('ref-key');
  });
});

describe('Dom calls after the patch', () => {
  it('focuses an element by name', async () => {
    const mounted = await start();
    clickButton(mounted, 'focus');
    await mounted.settled();
    expect(document.activeElement).toBe(mounted.get('input'));
  });

  it('focuses an element that the same message renders', async () => {
    const mounted = await start();
    clickButton(mounted, 'add and focus');
    await mounted.settled();
    const rows = mounted.root.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[1].getAttribute('i-ref')).toBe('row a2');
    expect(rows[1].matches(':focus') || document.activeElement === rows[1]).toBe(true);
  });

  it('warns and does nothing for a missing ref', async () => {
    const mounted = await start();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clickButton(mounted, 'missing');
    await mounted.settled();
    expect(warn).toHaveBeenCalledWith('idlip: no ref nope');
  });

  it('resets a form', async () => {
    const mounted = await start();
    const input = mounted.get('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('not a field');
    }
    input.value = 'typed';
    clickButton(mounted, 'clear');
    await mounted.settled();
    expect(input.value).toBe('x');
  });
});

describe('Dom.measure', () => {
  it('gives the rect to the continuation', async () => {
    const mounted = await start();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(1, 2, 30, 40));
    clickButton(mounted, 'measure');
    await mounted.settled();
    expect(mounted.text('p')).toBe('30x40');
  });
});

describe('Dom.measure of a missing ref', () => {
  it('warns and gives null', async () => {
    const mounted = await start();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clickButton(mounted, 'measure missing');
    await mounted.settled();
    expect(warn).toHaveBeenCalledWith('idlip: no ref nope');
    expect(mounted.text('p')).toBe('none');
  });
});

describe('await Random.id()', () => {
  it('adds a row with the id from the task', async () => {
    const mounted = await start();
    clickButton(mounted, 'add');
    await mounted.settled();
    const rows = mounted.root.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[1].getAttribute('i-ref')).toMatch(/^row [0-9a-f-]{36}$/);
  });
});
