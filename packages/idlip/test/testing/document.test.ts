// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const PAGE = `export default function Page(props: { n: number }) {
  let n = props.n;
  function up() { n = n + 1; }
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>count</title>
      </head>
      <body>
        <p>{n} clicks</p>
        <button on:click={up}>up</button>
      </body>
    </html>
  );
}`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

describe('mount of a document component', () => {
  it('uses the body as the root and the head elements as the document head', async () => {
    page = await mount(PAGE, { n: 2 });
    expect(page.text('p')).toBe('2 clicks');
    expect(page.root.querySelector('title')).toBeNull();
    expect(document.head.querySelector('title')?.textContent).toBe('count');
    page.click('button');
    await page.settled();
    expect(page.text('p')).toBe('3 clicks');
    page.stop();
    page = undefined;
    // `stop` takes the head elements out again.
    expect(document.head.querySelector('meta')).toBeNull();
    expect(document.head.textContent).not.toContain('count');
  });
});
