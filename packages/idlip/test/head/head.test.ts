// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';

const SOURCE = `
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Page(): JSX.Element {
  let count = 1;
  let extra = false;
  const title = \`\${count} left\`;
  function inc() {
    count = count + 1;
  }
  function toggle() {
    extra = !extra;
  }
  return (
    <main>
      <Head>
        <title>{title}</title>
        <meta name="description" content={\`\${count} items\`} />
      </Head>
      <button id="inc" on:click={inc}>Add</button>
      <button id="toggle" on:click={toggle}>Toggle</button>
      {extra && (
        <Head>
          <title>Extra</title>
          <meta name="extra" content="yes" />
        </Head>
      )}
    </main>
  );
}
`;

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
  document.title = '';
});

function meta(name: string): string | undefined {
  return document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? undefined;
}

async function flush(): Promise<void> {
  await page?.settled();
  await new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
}

it('writes the last title first on the server', async () => {
  page = await mount(SOURCE.replace('let extra = false', 'let extra = true'), {});
  const titles = [...document.head.querySelectorAll('title')].map((title) => title.textContent);
  expect(titles).toEqual(['Extra', '1 left']);
  expect(document.head.firstElementChild?.textContent).toBe('Extra');
  expect(document.title).toBe('Extra');
  expect(meta('extra')).toBe('yes');
});

it('adds and removes a head block with its condition, and the last title wins', async () => {
  page = await mount(SOURCE, {});
  expect(document.title).toBe('1 left');
  expect(meta('description')).toBe('1 items');
  expect(meta('extra')).toBeUndefined();
  page.click('#inc');
  await flush();
  expect(document.title).toBe('2 left');
  expect(meta('description')).toBe('2 items');
  page.click('#toggle');
  await flush();
  expect(meta('extra')).toBe('yes');
  expect(document.title).toBe('Extra');
  page.click('#inc');
  await flush();
  expect(meta('description')).toBe('3 items');
  page.click('#toggle');
  await flush();
  expect(meta('extra')).toBeUndefined();
  expect(document.title).toBe('3 left');
});

it('rejects a title outside Head and allows one in svg', () => {
  const bad = compile(
    `import type { JSX } from 'idlip/jsx-runtime';
export default function P(): JSX.Element { return <main><title>x</title></main>; }`,
    '/src/b.tsx',
  );
  expect(bad.diagnostics.some((item) => item.rule === 'title-outside-head')).toBe(true);
  const ok = compile(
    `import type { JSX } from 'idlip/jsx-runtime';
export default function P(): JSX.Element { return <main><svg><title>x</title></svg></main>; }`,
    '/src/o.tsx',
  );
  expect(ok.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
});

it('compiles a module without Head with no head output', () => {
  const compiled = compile(
    `import type { JSX } from 'idlip/jsx-runtime';
export default function P(): JSX.Element { return <main>hi</main>; }`,
    '/src/n.tsx',
  );
  expect(compiled.server).not.toContain('head');
  expect(compiled.manifest.head).toBeUndefined();
});

const ROWS = `
import { For, Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Page(): JSX.Element {
  let names = [{ id: 'a' }, { id: 'b' }];
  function add() {
    names = [...names, { id: 'c' }];
  }
  function drop() {
    names = names.slice(1);
  }
  return (
    <main>
      <button id="add" on:click={add}>Add</button>
      <button id="drop" on:click={drop}>Drop</button>
      <For each={names} key="id">
        {(row) => (
          <p>
            {row.id}
            <Head>
              <meta name={row.id} content="row" />
            </Head>
          </p>
        )}
      </For>
    </main>
  );
}
`;

it('adds and removes the head elements of list rows', async () => {
  page = await mount(ROWS, {}, { check: false });
  expect(meta('a')).toBe('row');
  expect(meta('b')).toBe('row');
  page.click('#add');
  await flush();
  expect(meta('c')).toBe('row');
  page.click('#drop');
  await flush();
  expect(meta('a')).toBeUndefined();
  expect(meta('b')).toBe('row');
  expect(meta('c')).toBe('row');
});
