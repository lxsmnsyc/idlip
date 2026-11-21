// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');
const TODO = readFileSync(join(FIXTURES, 'todo/todo.idlip.tsx'), 'utf8');
const INITIAL = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('mount', () => {
  it('renders on the server and loads nothing before an event', async () => {
    page = await mount(TODO, { initial: INITIAL });
    expect(page.text('p')).toBe('1 left');
    expect(page.root.querySelectorAll('li')).toHaveLength(2);
    await page.settled();
    expect(page.loaded()).toEqual([]);
  });

  it('loads the handler and the binding chunk for the first checkbox click', async () => {
    page = await mount(TODO, { initial: INITIAL });
    page.click('li:nth-child(2) input');
    await page.settled();
    expect(page.loaded()).toEqual(['handler=toggle', 'binding=todos.*.done']);
    expect(page.text('p')).toBe('0 left');
    expect(page.get('li:nth-child(2)').className).toBe('done');
  });

  it('types into the field and adds a todo', async () => {
    page = await mount(TODO, { initial: INITIAL });
    page.input('form input', 'Ship it');
    await page.settled();
    expect(page.loaded()).toEqual(['handler=setDraft', 'binding=draft']);
    expect(page.get('button').hasAttribute('disabled')).toBe(false);
    page.get('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await page.settled();
    expect(page.root.querySelectorAll('li')).toHaveLength(3);
    expect(page.text('p')).toBe('2 left');
  });

  it('keeps the page equal to the server render over several steps', async () => {
    page = await mount(TODO, { initial: INITIAL });
    const form = page.get('form');
    const steps: (() => void)[] = [
      () => {
        page?.click('li:nth-child(1) input');
      },
      () => {
        page?.input('form input', 'One');
      },
      () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      },
      () => {
        page?.click('li:nth-child(3) input');
      },
      () => {
        page?.click('li:nth-child(2) input');
      },
      () => {
        page?.input('form input', 'Two');
      },
    ];
    for (const step of steps) {
      step();
      // Each settled step re-renders on the server and compares.
      await page.settled();
    }
    expect(page.root.querySelectorAll('li')).toHaveLength(3);
    expect(page.text('p')).toBe('1 left');
  });

  it('fails the check and names the first node that differs', async () => {
    page = await mount(TODO, { initial: INITIAL });
    // A node no binding patches, as a stale binding would leave it.
    page.get('button').textContent = 'Stale';
    page.click('li:nth-child(2) input');
    await expect(page.settled()).rejects.toThrow(/differs from a server render.*<button>/);
  });

  it('skips the check with check: false', async () => {
    page = await mount(TODO, { initial: INITIAL }, { check: false });
    page.get('button').textContent = 'Stale';
    page.click('li:nth-child(2) input');
    await page.settled();
    expect(page.text('p')).toBe('0 left');
  });

  it('loads nothing after stop', async () => {
    page = await mount(TODO, { initial: INITIAL });
    const box = page.get('li:nth-child(2) input');
    page.stop();
    box.click();
    await sleep(50);
    expect(page.loaded()).toEqual([]);
  });

  it('refuses a second page until the first stops', async () => {
    page = await mount(TODO, { initial: INITIAL });
    await expect(mount(TODO, { initial: INITIAL })).rejects.toThrow(/Stop the previous page first/);
    page.stop();
    expect(Reflect.has(globalThis, '$idlip')).toBe(false);
    page = await mount(TODO, { initial: INITIAL });
    expect(page.text('p')).toBe('1 left');
  });

  it('rejects settled with the error of a throwing handler', async () => {
    const source = `
      export default function Boom() {
        let n = 0;
        function boom() {
          throw new Error('boom');
        }
        function inc() {
          n = n + 1;
        }
        return (
          <div>
            <button id="boom" on:click={() => boom()}>boom</button>
            <button id="inc" on:click={() => inc()}>inc</button>
            <p>{n}</p>
          </div>
        );
      }
    `;
    page = await mount(source, {});
    page.click('#boom');
    await expect(page.settled()).rejects.toThrow('boom');
    // The error is reported once, and the page keeps working.
    page.click('#inc');
    await page.settled();
    expect(page.text('p')).toBe('1');
  });

  it('throws on a source that does not compile', async () => {
    await expect(mount('export default function A() { return <a {...x} />; }', {})).rejects.toThrow(
      /does not compile/,
    );
  });
});
