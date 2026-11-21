// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const TRY = `
import { Head, Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

function check(value: number): number {
  if (value < 0) {
    throw new Error('bad');
  }
  return value;
}

export default function Page(): JSX.Element {
  return (
    <main>
      <Head>
        <meta name="outer" content="yes" />
      </Head>
      <Try catch={(error) => <p>{error}</p>}>
        <Head>
          <title>Inside</title>
          <meta name="inside" content="yes" />
        </Head>
        <b>{check(-1)}</b>
      </Try>
      <Try catch={(error) => <p>{error}</p>}>
        <Head>
          <meta name="kept" content="yes" />
        </Head>
        <b>{check(1)}</b>
      </Try>
    </main>
  );
}
`;

const ORDER = `
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Page(): JSX.Element {
  let early = false;
  function toggle() {
    early = !early;
  }
  return (
    <main>
      <button id="toggle" on:click={toggle}>Toggle</button>
      {early && (
        <Head>
          <title>Early</title>
        </Head>
      )}
      <Head>
        <title>Last</title>
      </Head>
    </main>
  );
}
`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  for (const title of document.head.querySelectorAll('title')) {
    title.remove();
  }
});

it('drops the head output of a Try body that throws', async () => {
  page = await mount(TRY, {});
  const names = [...document.head.querySelectorAll('meta')].map((item) =>
    item.getAttribute('name'),
  );
  expect(names).toEqual(['outer', 'kept']);
  expect(document.head.querySelector('title')).toBeNull();
});

it('takes the last title of the page, also when an earlier block is added', async () => {
  page = await mount(ORDER, {});
  expect(document.title).toBe('Last');
  page.click('#toggle');
  await page.settled();
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
  expect(document.head.querySelectorAll('title')).toHaveLength(2);
  expect(document.title).toBe('Last');
});

const CHILD = `
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Card(): JSX.Element {
  let open = false;
  function toggle() {
    open = !open;
  }
  return (
    <section>
      <Head>
        <meta name="card" content="yes" />
      </Head>
      <button on:click={toggle}>{open ? 'a' : 'b'}</button>
    </section>
  );
}
`;

it('records the head output of a child component through the shared context', async () => {
  const compiled = compile(CHILD, '/src/card.idlip.tsx', { child: true });
  expect(compiled.manifest.head).toBe(true);
  const code = compiled.server.replace(
    /^import .* from 'idlip\/server';/m,
    'const text$ = (value) => String(value);',
  );
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const loaded: unknown = await import(/* @vite-ignore */ url);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const render = Reflect.get(loaded as object, 'default') as (...args: unknown[]) => string;
  const calls: [number, string][] = [];
  const context = {
    state() {},
    headId: () => 7,
    head(id: number, markup: string) {
      calls.push([id, markup]);
    },
  };
  const markup = render({}, context, undefined, 'items.0');
  expect(calls).toEqual([[7, '<meta name="card" content="yes" i-head="7.0">']]);
  expect(markup).toContain('<!--c');
});
