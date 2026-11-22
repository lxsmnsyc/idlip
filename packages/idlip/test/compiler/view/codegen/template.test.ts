// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { clone$ } from '../../../../src/core/helpers.ts';
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
  throw new Error(`No ${prefix} chunk: ${JSON.stringify(result.diagnostics)}`);
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

  // A row body in a list of `{ id, label }` rows. `show` reads by the state, so `show(view)`
  // would be a dynamic hole outside a row.
  function compileRows(row: string, parent = 'ul'): ReturnType<typeof compile> {
    const source = `
      import { For } from 'idlip';
      function show(view: { mode: string; a: string; b: string }): string {
        return view.mode === 'a' ? view.a : view.b;
      }
      export default function App() {
        let rows = [{ id: 1, label: 'a' }];
        let mode = 'a';
        let a = 'x';
        let b = 'y';
        const view = { mode, a, b };
        function touch() {
          mode = 'b';
          a = a + '!';
          b = b + '!';
          rows = [];
        }
        return (
          <div>
            <button on:click={touch}>touch</button>
            <${parent}>
              <For each={rows} key={(row) => row.id}>{(row) => ${row}}</For>
            </${parent}>
          </div>
        );
      }
    `;
    return compile(source, '/src/app.tsx');
  }

  function findRowChunk(row: string, parent = 'ul'): string {
    for (const module of compileRows(row, parent).client) {
      if (module.chunk.startsWith('list=')) {
        return module.code;
      }
    }
    throw new Error('No list chunk');
  }

  it.each([
    ['a hole in a pre', '<li><pre>{row.label}</pre></li>', 'ul'],
    ['a row inside svg', '<text>{row.label}</text>', 'svg'],
    ['a write inside a template', '<li><template><b>{row.label}</b></template></li>', 'ul'],
    ['static events only', '<li><a on:click={() => touch()}>static</a></li>', 'ul'],
  ])('renders HTML for %s', (_name, row, parent) => {
    expect(findRowChunk(row, parent)).not.toContain('clone$');
  });

  it.each([
    ['a text hole directly in a table row', '<tr>{row.label}</tr>', 'tbody', 'html-nesting'],
    ['a hole in a textarea', '<li><textarea>{row.label}</textarea></li>', 'ul', 'codegen-raw-text'],
  ])('never sees %s: the compiler rejects it', (_name, row, parent, rule) => {
    const rules: string[] = [];
    for (const diagnostic of compileRows(row, parent).diagnostics) {
      rules.push(diagnostic.rule);
    }
    expect(rules).toContain(rule);
  });

  it('throws when the parse does not find every mark, and clones per document', () => {
    // The walk does not enter the content of a nested `<template>`.
    const hidden = { h: '<li><template><b i-x="1"></b></template></li>', n: 1 };
    expect(() => clone$(hidden, document)).toThrow(/1 marks and the parse found 0/);

    const template = { h: '<li i-x="1"><!--x2--></li>', n: 2 };
    const [fragment, item, text] = clone$(template, document);
    expect(fragment.firstChild).toBe(item);
    expect(text.nodeType).toBe(Node.TEXT_NODE);
    expect(item instanceof Element && item.hasAttribute('i-x')).toBe(false);
    const other = document.implementation.createHTMLDocument('');
    const [, otherItem] = clone$(template, other);
    expect(otherItem.ownerDocument).toBe(other);
  });

  it.each([
    ['a static template next to a hole', '<li>{row.label}<template><b>x</b></template></li>'],
    ['an svg element inside an HTML row', '<li><svg><text>{row.label}</text></svg></li>'],
    ['a cell of a table row', '<tr><td>{row.label}</td></tr>'],
    // Rows record no reads, so a dynamic hole in one keeps static paths (`plan.ts`).
    ['a hole that is dynamic outside rows', '<li>{show(view)} {row.label}</li>'],
  ])('clones %s', (_name, row) => {
    expect(findRowChunk(row, row.startsWith('<tr') ? 'tbody' : 'ul')).toContain('clone$');
  });
});
