// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { mount } from '../../../../src/testing/index.ts';
import type { MountedPage } from '../../../../src/testing/index.ts';

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

const SOURCE = `
  import { For } from 'idlip';
  export default function App() {
    let n = 0;
    let rows = [{ id: 'a', label: 'A' }];
    function bump() {
      n = n + 1;
      rows = [...rows, { id: 'b' + n, label: '' }];
    }
    return (
      <main>
        <b class={n > 0 ? 'on' : ''} on:click={bump}>{n}</b>
        <p>Count: {n}</p>
        <pre>{n}</pre>
        <ul>
          <For each={rows} key={(row) => row.id}>
            {(row) => <li>{row.label}</li>}
          </For>
        </ul>
      </main>
    );
  }
`;

describe('text that fills an element', () => {
  it('writes no markers and puts the hole id on the element', () => {
    const { server, manifest, diagnostics } = compile(SOURCE, '/src/app.tsx');
    expect(diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    // The `b` holds its class and its text.
    expect(server).toContain(' i-a="0 1">');
    // A hole with a sibling, and a hole in a `pre`, keep their markers.
    expect(server).toContain('Count: <!--t2-->');
    expect(server).toContain('<pre><!--t3-->');
    // The row's text is found through the `li`.
    expect(manifest.lists['4'].bindings).toEqual(['a5']);
    expect(manifest.groups.n.bindings).toEqual(['a0', 'a1', 't2', 't3']);
  });

  it('names the binding after the element and sets the text through it', () => {
    const { client } = compile(SOURCE, '/src/app.tsx');
    const chunk = client.find((module) => module.chunk === 'binding=n');
    expect(chunk?.code).toContain(
      'export function a1(start, { model }) {\nsetText$(start, model.n);',
    );
    const list = client.find((module) => module.chunk === 'list=4');
    // The clone has no markers around the row's text.
    expect(list?.code).toContain(`h: '<!--i--><li i-a="5"><!--x1--></li><!--/i-->'`);
  });

  it('patches the text and renders new rows like the server', async () => {
    page = await mount(SOURCE, {});
    expect(page.text('b')).toBe('0');
    page.click('b');
    // `settled` compares the page with a server render of the new model.
    await page.settled();
    expect(page.get('b').outerHTML).toBe(
      '<b class="on" on:click="[&quot;bump&quot;,[]]" i-a="0 1">1</b>',
    );
    expect(page.get('ul').innerHTML).toBe(
      '<!--l4--><!--i--><li i-a="5">A</li><!--/i--><!--i--><li i-a="5"></li><!--/i--><!--/l-->',
    );
  });
});
