// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { track$ } from '../../src/core/dynamic.ts';
import { render } from '../../src/server/render.ts';
import * as serverExports from '../../src/server/index.ts';
import { mount } from '../../src/testing/index.ts';
import type { MountedPage } from '../../src/testing/index.ts';
import { bindImports, toDataUrl } from '../../src/testing/modules.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures/dynamic');
const BOARD = readFileSync(join(FIXTURES, 'dynamic.tsx'), 'utf8');
const PICK = readFileSync(join(FIXTURES, 'pick.tsx'), 'utf8');
const INITIAL = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build the runtime', done: false },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

/** Renders the module on the server and returns the HTML. */
async function renderBoard(source: string, props: Record<string, unknown>): Promise<string> {
  const compiled = compile(source, '/src/app.tsx');
  const key = '$idlipDynamicTest';
  Reflect.set(globalThis, key, { server: { ...serverExports }, client: {} });
  try {
    const code = bindImports(compiled.server, key);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const server = (await import(/* @vite-ignore */ toDataUrl(code))) as {
      default: (props: unknown) => unknown;
    };
    return await render(server.default, props);
  } finally {
    Reflect.deleteProperty(globalThis, key);
  }
}

describe('compile', () => {
  it('puts the dynamic holes in one group with no paths', () => {
    const { manifest, client } = compile(BOARD, '/src/app.tsx');
    expect(manifest.groups.$dynamic).toEqual({
      paths: [],
      chunk: 'binding=$dynamic',
      bindings: ['t0', 'a1', 't2'],
      covers: [],
    });
    expect(client.map((chunk) => chunk.chunk)).toContain('binding=$dynamic');
  });

  it('leaves a module with no dynamic hole without the group', () => {
    const todo = readFileSync(join(FIXTURES, '../todo/todo.tsx'), 'utf8');
    const { manifest, server } = compile(todo, '/src/todo.tsx');
    expect(manifest.groups.$dynamic).toBeUndefined();
    expect(server).not.toContain('track');
  });

  it('binds a model-alias hole inside a row with its static paths', () => {
    const source = BOARD.replace('<b on:click', '<u>{summarize(stats)}</u><b on:click');
    const { diagnostics, manifest } = compile(source, '/src/app.tsx');
    expect(diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    // The row's hole is in a static group, and the dynamic group keeps the top-level holes.
    expect(manifest.groups.$dynamic.bindings).toEqual(['t0', 'a1', 't2']);
  });

  it('keeps a dynamic hole on a URL attribute behind safeUrl', () => {
    const source = BOARD.replace('<p>{summarize(stats)}</p>', '<a href={summarize(stats)}>go</a>');
    const { diagnostics, server, client } = compile(source, '/src/app.tsx');
    expect(diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(server).toMatch(/attr\$\('href', safeUrl\$\(track\$\(/);
    const chunk = client.find((item) => item.chunk === 'binding=$dynamic');
    expect(chunk?.code).toMatch(/setAttr\$\(el, 'href', safeUrl\$\(track\$\(/);
  });

  it('preloads the dynamic chunk with each handler that has write paths', () => {
    const { manifest } = compile(BOARD, '/src/app.tsx');
    for (const entry of Object.values(manifest.handlers)) {
      expect(entry.bindings).toContain('$dynamic');
    }
  });
});

describe('track$', () => {
  it('records the container for in, Object.keys and a spread', () => {
    const store: Record<string, string[]> = {};
    const model = { cfg: { a: 1 }, list: [{ id: 1 }] };
    track$(store, 'x', model, (view) => {
      // The proxy stands in for the model, so the read goes through `Reflect`.
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      const cfg: object = Reflect.get(Object(view), 'cfg');
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      const list: object = Reflect.get(Object(view), 'list');
      return [Object.keys(cfg), 'a' in cfg, { ...list }];
    });
    expect(store.x).toEqual(['cfg.*', 'list.*']);
  });
});

describe('server', () => {
  it('writes the paths each dynamic hole read into the state script', async () => {
    const html = await renderBoard(BOARD, { initial: INITIAL });
    expect(html).toContain('<!--t0-->1 left, filter all<!--/t-->');
    expect(html).toContain('title="1 left, filter all"');
    const state = /<script i-state[^>]*>([\s\S]*)<\/script>/.exec(html)?.[1] ?? '';
    for (const name of ['t0', 'a1', 't2']) {
      expect(state).toContain(`${name}:["filter","todos.*.done","todos.length"]`);
    }
  });
});

describe('patch', () => {
  it('patches the dynamic holes when a path they read changes', async () => {
    page = await mount(BOARD, { initial: INITIAL });
    expect(page.text('main > p')).toBe('1 left, filter all');
    expect(page.loaded()).toEqual([]);
    page.click('li:nth-child(2) input');
    await page.settled();
    expect(page.loaded().toSorted()).toEqual([
      'binding=$dynamic',
      'binding=todos.*.done',
      'handler=toggle',
    ]);
    expect(page.text('main > p')).toBe('0 left, filter all');
    expect(page.text('i')).toBe('0 left, filter all');
    expect(page.get('i').getAttribute('title')).toBe('0 left, filter all');
  });

  it('does not load the dynamic chunk for a path the holes did not read', async () => {
    page = await mount(BOARD, { initial: INITIAL });
    page.click('li:nth-child(1) b');
    await page.settled();
    // The handler preloads the dynamic chunk, but no dynamic hole runs.
    expect(page.loaded().toSorted()).toEqual([
      'binding=$dynamic',
      'binding=todos.*.text',
      'handler=rename',
    ]);
    expect(page.text('main > p')).toBe('1 left, filter all');
    page.get('button').click();
    await page.settled();
    expect(page.text('main > p')).toBe('1 left, filter open');
  });

  it('runs only the dynamic holes whose paths changed', async () => {
    page = await mount(PICK, {});
    const out = page.get('.out');
    expect(out.textContent).toBe('first');
    // `b` is not read while `mode` is `a`.
    page.click('button:nth-of-type(3)');
    await page.settled();
    expect(page.loaded().toSorted()).toEqual(['binding=$dynamic', 'handler=setB']);
    expect(out.textContent).toBe('first');
    // `a` is read.
    page.click('button:nth-of-type(2)');
    await page.settled();
    expect(out.textContent).toBe('first!');
  });

  it('uses the new paths after the reads change', async () => {
    page = await mount(PICK, {});
    const out = page.get('.out');
    page.click('button:nth-of-type(1)');
    await page.settled();
    expect(out.textContent).toBe('second');
    const before = page.loaded().length;
    // Now `b` is read and `a` is not.
    page.click('button:nth-of-type(2)');
    await page.settled();
    expect(page.loaded().slice(before)).toEqual(['handler=setA']);
    expect(out.textContent).toBe('second');
    page.click('button:nth-of-type(3)');
    await page.settled();
    expect(out.textContent).toBe('second!');
  });
});
