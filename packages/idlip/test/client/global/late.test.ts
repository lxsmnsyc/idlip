// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

const LATE = `
export default function App() {
  let open = false;
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

const LATE_DOCUMENT = LATE.replace('<window', '<document');

describe('global events added by a patch', () => {
  it('listens on window for an event type that was not on the page at load', async () => {
    page = await mount(LATE, {});
    page.click('button');
    await page.settled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await page.settled();
    expect(page.text('output')).toBe('1');
  });

  it('listens on document for an event type that was not on the page at load', async () => {
    page = await mount(LATE_DOCUMENT, {});
    page.click('button');
    await page.settled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await page.settled();
    expect(page.text('output')).toBe('1');
  });
});
