// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/compiler/index.ts';
import { analyze } from '../../../../src/compiler/view/analyze/index.ts';
import { Emitter, createUsage } from '../../../../src/compiler/view/codegen/expr.ts';
import { planBindings } from '../../../../src/compiler/view/codegen/plan.ts';
import { buildBody, createCloneContext } from '../../../../src/compiler/view/codegen/template.ts';
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
      /const templateL\d+\$ = \{ h: '<!--i--><li i-x="1"[^>]*><a i-x="2"[^>]*><!--t\d+--><!--x3-->/,
    );
    expect(code).toContain('putAttr$($n[1], ');
    expect(code).toContain("setOn$($n[2], 'click', ['select', [row.id]]);");
  });

  it('clones a row with a condition and a nested list, and a static branch', () => {
    const code = findChunk(
      `
      import { For } from 'idlip';
      export default function App() {
        let rows = [{ id: 1, on: true, tags: [{ id: 2 }] }];
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
                {(row) => (
                  <li>
                    {row.on ? <b>on</b> : 'off'}
                    <For each={row.tags} key={(tag) => tag.id}>{(tag) => <i>{tag.id}</i>}</For>
                  </li>
                )}
              </For>
            </ul>
          </div>
        );
      }
    `,
      'list=',
    );
    // The condition's start comment and the nested list's end comment are marks.
    expect(code).toMatch(/<li><!--c\d+:x1--><!--\/c--><!--l\d+--><!--\/lx2--><\/li>/);
    expect(code).toContain('$n[1].data += 0;');
    expect(code).toMatch(/for \(const tag of row\.tags\) \{/);
    expect(code).toContain('$n[2].before(');
    expect(code).toContain('export const blocks = true;');
    expect(code).not.toContain('text$(');
    // A branch with nothing to write clones its template as it is, and an empty one is an
    // empty fragment.
    const branch = findChunk(
      DISCLOSURE.replace('<h2>{title}</h2>', '').replace(' class={{ open }}', ''),
      'binding=open',
    );
    expect(branch).toContain('return clone$(templateC0_0$, $doc)[0];');
    expect(branch).toContain('return $doc.createDocumentFragment();');
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
    ['a text hole directly in a table row', '<tr>{row.label}</tr>', 'tbody', 'html-nesting'],
    [
      'a text hole directly in a colgroup',
      '<table><colgroup>{row.label}</colgroup></table>',
      'div',
      'html-nesting',
    ],
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
    // A comment mark keeps the data before the mark: the start or end of a block.
    const [, start, end] = clone$({ h: '<!--c4:x1--><!--/lx2-->', n: 2 }, document);
    expect(start.nodeValue).toBe('c4:');
    expect(end.nodeValue).toBe('/l');
    expect(item instanceof Element && item.hasAttribute('i-x')).toBe(false);
    const other = document.implementation.createHTMLDocument('');
    const [, otherItem] = clone$(template, other);
    expect(otherItem.ownerDocument).toBe(other);
  });

  it('writes the newline a pre and a textarea drop, and sets a textarea text', () => {
    const result = compileRows("<li><pre>{row.label}</pre><textarea>{'fixed'}</textarea></li>");
    let code = '';
    for (const module of result.client) {
      code += module.chunk.startsWith('list=') ? module.code : '';
    }
    expect(code).toContain('<pre>\\n<!--t');
    expect(code).toContain('<textarea i-x="2">\\n</textarea>');
    expect(code).toContain('$n[2].textContent += getText$(');
    expect(result.server).toContain('<pre>\n<!--t');
  });

  it('clones a row inside svg and math in its namespace', () => {
    const svg = findRowChunk('<text>{row.label}</text>', 'svg');
    expect(svg).toContain('<!--i--><text><!--t');
    expect(svg).toContain("s: 'svg' };");
    expect(findRowChunk('<mi>{row.label}</mi>', 'math')).toContain("s: 'mathml' };");
    const [fragment] = clone$({ h: '<circle i-x="1"></circle>', n: 1, s: 'svg' }, document);
    const circle = fragment.firstChild;
    expect(circle instanceof Element && circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // happy-dom keeps MathML in the HTML namespace, so the clone matches its page parse.
    const page = document.createElement('div');
    page.innerHTML = '<math><mi>x</mi></math>';
    const [math] = clone$({ h: '<mi>x</mi>', n: 0, s: 'mathml' }, document);
    const mi = math.firstChild;
    expect(mi instanceof Element && mi.namespaceURI).toBe(
      page.firstElementChild?.firstElementChild?.namespaceURI,
    );
  });

  it('clones a branch with a <Head> whose elements write values', async () => {
    const source = `
      import { Head } from 'idlip';
      export default function Page() {
        let open = false;
        let count = 1;
        function toggle() {
          open = !open;
          count = count + 1;
        }
        return (
          <main>
            <button on:click={toggle}>toggle</button>
            {open && (
              <section>
                <Head>
                  <title>{\`\${count} open\`}</title>
                  <meta name="count" content={\`\${count}\`} />
                </Head>
                <p>{count}</p>
              </section>
            )}
          </main>
        );
      }
    `;
    const code = findChunk(source, 'binding=open');
    expect(code).toMatch(/<!--c\d+:h--><template i-x="1" i-head=""[^>]*><\/template><!--\/c-->/);
    expect(code).toContain('$n[1].content.append(');
    const page = await mount(source, {});
    try {
      page.click('button');
      await page.settled();
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      expect(document.title).toBe('2 open');
      expect(document.head.querySelector('meta[name="count"]')?.getAttribute('content')).toBe('2');
      expect(page.root.querySelector('p')?.textContent).toBe('2');
    } finally {
      page.stop();
      document.title = '';
    }
  });

  it('records the reads of a dynamic hole in a cloned body', () => {
    // The plan makes a hole dynamic only at the top of a root view, which renders on the server.
    // A plan that marks the holes of a branch dynamic shows what a cloned body writes for one.
    const ir = analyze('/src/app.tsx', DISCLOSURE);
    const component = ir.components[0];
    const plan = planBindings(component, () => {});
    const branch = component.view[0].kind === 'element' ? component.view[0].children[1] : undefined;
    if (branch?.kind !== 'condition') {
      throw new Error('No branch');
    }
    for (const hole of component.holes) {
      plan.dynamic.add(hole.id);
    }
    const usage = createUsage();
    const emitter = new Emitter('client', usage, () => {});
    const body = buildBody(
      branch.then,
      'html',
      'templateC0_0$',
      createCloneContext(component, plan, emitter),
    );
    const code = body.pre.join('\n');
    expect(code).toMatch(
      /putAttr\$\(\$n\[1\], 'class', track\$\(dynamic, 'a\d+', model, \(model\) => /,
    );
    expect(code).toMatch(
      /putText\$\(\$n\[2\], track\$\(dynamic, 't\d+', model, \(model\) => model\.title\)\);/,
    );
    expect([...usage.scope].toSorted()).toEqual(['dynamic', 'model']);
  });

  it('clones the content of a template with a write from its own template', () => {
    const code = findRowChunk('<li><template><b>{row.label}</b></template></li>');
    expect(code).toMatch(/<li><template i-x="1"><\/template><\/li>/);
    expect(code).toMatch(/\$n\[1\]\.content\.append\(\$n2\[0\]\);/);
  });

  it.each([
    ['a text hole directly in a select', '<li><select>{row.label}<option>o</option></select></li>'],
    ['a row with static events only', '<li><a on:click={() => touch()}>static</a></li>'],
    ['a static template next to a hole', '<li>{row.label}<template><b>x</b></template></li>'],
    ['an svg element inside an HTML row', '<li><svg><text>{row.label}</text></svg></li>'],
    ['a cell of a table row', '<tr><td>{row.label}</td></tr>'],
    // Rows record no reads, so a dynamic hole in one keeps static paths (`plan.ts`).
    ['a hole that is dynamic outside rows', '<li>{show(view)} {row.label}</li>'],
  ])('clones %s', (_name, row) => {
    expect(findRowChunk(row, row.startsWith('<tr') ? 'tbody' : 'ul')).toContain('clone$');
  });
});
