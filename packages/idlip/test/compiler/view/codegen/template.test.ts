// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { mount } from '../../../../src/testing/index.ts';

const DISCLOSURE = `
  export default function Disclosure() {
    let open = false;
    let title = 'Hello & <you>';
    function toggle() {
      open = !open;
    }
    return (
      <div>
        <button on:click={toggle}>toggle</button>
        {open && (
          <section class={{ open }}>
            <h2>{title}</h2>
            <p>static</p>
          </section>
        )}
      </div>
    );
  }
`;

function findChunk(source: string, prefix: string): string {
  const result = compile(source, '/src/app.tsx');
  for (const module of result.client) {
    if (module.chunk.startsWith(prefix)) {
      return module.code;
    }
  }
  throw new Error(`No ${prefix} chunk`);
}

describe('cloned templates', () => {
  it('renders a disclosure branch by a clone', async () => {
    const code = findChunk(DISCLOSURE, 'binding=open');
    expect(code).toContain('clone$(templateC');
    expect(code).not.toContain('text$(');

    const page = await mount(DISCLOSURE, {});
    try {
      page.click('button');
      await page.settled();
      const section = page.root.querySelector('section');
      expect(section?.className).toBe('open');
      expect(section?.querySelector('h2')?.textContent).toBe('Hello & <you>');
      page.click('button');
      await page.settled();
      expect(page.root.querySelector('section')).toBeNull();
    } finally {
      page.stop();
    }
  });

  it('clones a row of elements, holes and events', () => {
    const code = findChunk(
      `
      import { For } from 'idlip';
      export default function App() {
        let rows = [{ id: 1, label: 'a' }];
        let selected = 0;
        function select(id: number) {
          selected = id;
        }
        return (
          <ul>
            <For each={rows} key={(row) => row.id}>
              {(row) => (
                <li class={selected === row.id ? 'on' : ''}>
                  <a on:click={() => select(row.id)}>{row.label}</a>
                </li>
              )}
            </For>
          </ul>
        );
      }
    `,
      'list=',
    );
    expect(code).toMatch(
      /const template\$ = \{ h: '<!--i--><li i-x="1"[^>]*><a i-x="2"[^>]*><!--t\d+--><!--x3-->/,
    );
    expect(code).toContain('putAttr$($n[1], ');
    expect(code).toContain("setOn$($n[2], 'click', ['select', [row.id]]);");
  });

  it('renders HTML for a row with a condition and for a static branch', () => {
    const code = findChunk(
      `
      import { For } from 'idlip';
      export default function App() {
        let rows = [{ id: 1, on: true }];
        let open = false;
        function flip() {
          open = !open;
        }
        return (
          <div>
            <button on:click={flip}>flip</button>
            {open && <p>static</p>}
            <ul>
              <For each={rows} key={(row) => row.id}>
                {(row) => <li>{row.on ? <b>on</b> : 'off'}</li>}
              </For>
            </ul>
          </div>
        );
      }
    `,
      'list=',
    );
    expect(code).not.toContain('clone$');
    expect(
      findChunk(
        DISCLOSURE.replace('<h2>{title}</h2>', '').replace(' class={{ open }}', ''),
        'binding=open',
      ),
    ).not.toContain('clone$');
  });
});
