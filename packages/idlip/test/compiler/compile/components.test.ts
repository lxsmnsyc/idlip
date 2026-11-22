// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { getChunkFile, getChunkId, listCompiled, splitModule } from '../../../src/core/format.ts';
import type { CompileResult } from '../../../src/core/format.ts';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const WIDGETS = readFileSync(
  join(import.meta.dirname, '../../fixtures/widgets/widgets.tsx'),
  'utf8',
);
const ITEMS = [
  { id: 'a1', label: 'One' },
  { id: 'a2', label: 'Two' },
];

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

function listErrors(result: CompileResult): string[] {
  const rules: string[] = [];
  for (const diagnostic of result.diagnostics) {
    rules.push(`${diagnostic.severity}:${diagnostic.rule}`);
  }
  return rules;
}

function findChunk(result: CompileResult, module: string, chunk: string): string {
  for (const component of listCompiled(result)) {
    if (component.manifest.module !== module) {
      continue;
    }
    for (const item of component.client) {
      if (item.chunk === chunk) {
        return item.code;
      }
    }
  }
  throw new Error(`No chunk ${chunk} of ${module}`);
}

describe('several components in one file', () => {
  it('gives each component its own module id, manifest and chunks', () => {
    const result = compile(WIDGETS, '/src/widgets.tsx');
    expect(listErrors(result)).toEqual([]);
    const modules = listCompiled(result).map((item) => item.manifest.module);
    expect(modules).toEqual([
      '/src/widgets.tsx',
      '/src/widgets.tsx#Counter',
      '/src/widgets.tsx#Row',
    ]);
    // The default export keeps the chunk ids of a one-component file.
    expect(result.client.map((item) => item.chunk)).toEqual([
      'handler=rename',
      'binding=title',
      'list=2',
    ]);
    // Each component renders as a child here, so each other one has a view chunk.
    expect(result.components?.[0].client.map((item) => item.chunk)).toEqual([
      'handler=increment',
      'binding=count',
      'view',
    ]);
    expect(getChunkId('/src/widgets.tsx#Counter', 'handler=increment')).toBe(
      '/src/widgets.tsx?idlip-Counter.handler=increment&lang.js',
    );
    expect(getChunkFile('handler=increment')).toBe('handler.increment.js');
  });

  it('exports a module record and a render function for a named component only', () => {
    const { server } = compile(WIDGETS, '/src/widgets.tsx');
    expect(server).toContain('export const $Counter = {');
    expect(server).toContain('export function Counter(props, context, model, path)');
    // The private component is not exported.
    expect(server).toMatch(/^const \$Row = \{/m);
    expect(server).toMatch(/^function Row\(props, context, model, path\)/m);
    expect(server).toContain('export const uses = [$Counter, $Row];');
    expect(server).toContain(
      "'/src/widgets.tsx?idlip-Counter.handler=increment&lang.js': '/src/widgets.tsx?idlip-Counter.handler=increment&lang.js',",
    );
  });

  it('adds a private child from a row with its own view chunk', () => {
    const result = compile(WIDGETS, '/src/widgets.tsx');
    const list = findChunk(result, '/src/widgets.tsx', 'list=2');
    expect(list).toContain("import * as Row from '/src/widgets.tsx?idlip-Row.view&lang.js';");
    expect(list).toContain("addChild(slot$(path, 1, item.id), '/src/widgets.tsx#Row', Row,");
  });

  it('renders, resumes, and loads only the chunks of the component a click is in', async () => {
    page = await mount(WIDGETS, { items: ITEMS }, { id: '/src/widgets.tsx' });

    page.click('h1');
    await page.settled();
    expect(page.text('h1')).toBe('Widgets!');
    expect(page.loaded().toSorted()).toEqual(['binding=title', 'handler=rename']);

    page.click('.counter button');
    await page.settled();
    expect(page.text('output')).toBe('2');
    expect(page.loaded().slice(2).toSorted()).toEqual([
      'Counter.binding=count',
      'Counter.handler=increment',
    ]);

    page.click('li button');
    await page.settled();
    expect(page.get('li').className).toBe('done');
    expect(page.root.querySelectorAll('li.done')).toHaveLength(1);
    expect(page.loaded().slice(4).toSorted()).toEqual(['Row.binding=done', 'Row.handler=toggle']);

    // The same handler in the second row loads nothing more.
    page.click('li:nth-child(2) button');
    await page.settled();
    expect(page.root.querySelectorAll('li.done')).toHaveLength(2);
    expect(page.loaded()).toHaveLength(6);
  });

  it('renders a component imported by name as a child', () => {
    const board = `import type { JSX } from 'idlip/jsx-runtime';
import { Counter as Tally } from './widgets.tsx';
export default function Board(): JSX.Element {
  let rows = [1];
  function add() { rows = [...rows, rows.length + 1]; }
  return <main><button on:click={add}>add</button><Tally start={0} />{rows.length > 1 ? <Tally start={5} /> : null}</main>;
}
`;
    const result = compile(board, '/src/board.tsx');
    expect(listErrors(result)).toEqual([]);
    expect(result.server).toContain("import { $Counter as Tally } from './widgets.tsx';");
    expect(result.server).toContain('export const uses = [Tally];');
    const branch = result.client.find((item) => item.code.includes('addChild'));
    expect(branch?.code).toContain("from '/src/widgets.tsx?idlip-Counter.view&lang.js'");
    expect(branch?.code).toContain("'/src/widgets.tsx#Counter'");
  });

  it('gives a named component that another file renders a view chunk', () => {
    const result = compile(WIDGETS.replace('<Counter start={1} />', ''), '/src/widgets.tsx', {
      children: ['Counter'],
    });
    expect(result.components?.[0].manifest.view).toEqual({ chunk: 'view' });
    const alone = compile(WIDGETS.replace('<Counter start={1} />', ''), '/src/widgets.tsx');
    expect(alone.components?.[0].manifest.view).toBeUndefined();
  });

  it('lets a component of the file render the default export', () => {
    const source = `export default function App() {
  let n = 0;
  function inc() { n = n + 1; }
  return <button on:click={inc}>{n}</button>;
}
export function Shell() {
  let open = true;
  function flip() { open = !open; }
  return <section><button on:click={flip}>flip</button><App /></section>;
}
`;
    const result = compile(source, '/src/app.tsx');
    expect(listErrors(result)).toEqual([]);
    expect(result.manifest.view).toEqual({ chunk: 'view' });
    expect(result.server).toContain('const $App = { manifest, chunks, default: App };');
    expect(result.server).toContain('$Shell.uses = [$App];');
  });
});

describe('component diagnostics', () => {
  it('rejects an arrow or function expression component', () => {
    const source = `export const Counter = () => {
  return <p>hi</p>;
};
export default function App() { return <Counter />; }
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toContain('error:component-form');
    const anonymous = 'export default () => <p>hi</p>;\n';
    expect(listErrors(compile(anonymous, '/src/b.tsx'))).toContain('error:component-form');
  });

  it('leaves a capitalized function value without JSX alone', () => {
    const source = `const Format = (value: number) => value.toFixed(2);
export default function App() { return <p>{Format(1)}</p>; }
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).not.toContain('error:component-form');
  });

  it('rejects a component exported under another name', () => {
    const source = `function Counter() { let n = 0; function inc() { n++; } return <p on:click={inc}>{n}</p>; }
export default function App() { return <p />; }
export { Counter as Tally };
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toContain('error:component-export');
  });

  it('rejects a component that is both the default and a named export', () => {
    const source = `export function App() { return <p />; }
export default App;
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toContain('error:component-export');
  });

  it('rejects two components whose names differ only in case', () => {
    const source = `export function Panel() { return <p />; }
export function PANEL() { return <b />; }
export default function App() { return <i />; }
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toContain('error:component-duplicate');
  });

  it('warns about a private stateful component that nothing renders', () => {
    const source = `function Unused() { let n = 0; function inc() { n = n + 1; } return <p on:click={inc}>{n}</p>; }
export default function App() { return <p />; }
`;
    const result = compile(source, '/src/a.tsx');
    expect(listErrors(result)).toEqual(['warning:component-unused']);
    expect(result.components).toBeUndefined();
  });

  it('rejects a module record name that the source declares', () => {
    const source = `const $Panel = 1;
export function Panel() { return <p>{$Panel}</p>; }
export default function App() { return <i />; }
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toContain('error:module-reserved-name');
  });

  it('rejects a record name in a file whose only component is named', () => {
    const source = `const $Counter = 1;
export function Counter() { let n = $Counter; function inc() { n = n + 1; } return <p on:click={inc}>{n}</p>; }
`;
    expect(listErrors(compile(source, '/src/a.tsx'))).toEqual(['error:module-reserved-name']);
  });

  it('names a function that returns JSX without a capital letter', () => {
    const lower = compile('export function counter() {\n  return <p />;\n}\n', '/src/a.tsx');
    expect(listErrors(lower)).toEqual(['error:component-name']);
    expect(lower.diagnostics[0].message).toContain('`Counter`');
    const dollar = compile('export function $B() {\n  return <p />;\n}\n', '/src/b.tsx');
    expect(listErrors(dollar)).toEqual(['error:component-name']);
    const plain = compile(
      'export function format(n: number) { return n.toFixed(1); }\nexport default function App() { return <p />; }\n',
      '/src/c.tsx',
    );
    expect(listErrors(plain)).toEqual([]);
  });

  it('points each component diagnostic at the declaration', () => {
    const duplicate = `export function Panel() { return <p />; }
export function PANEL() { return <b />; }
export default function App() { return <i />; }
`;
    const [first] = compile(duplicate, '/src/a.tsx').diagnostics;
    expect(first.span.start).toBe(duplicate.indexOf('function PANEL'));

    const both = 'export function App() { return <p />; }\nexport default App;\n';
    const [twice] = compile(both, '/src/b.tsx').diagnostics;
    expect(twice.rule).toBe('component-export');
    expect(twice.span.start).toBe(both.indexOf('function App'));

    const unused = `function Unused() { let n = 0; function inc() { n = n + 1; } return <p on:click={inc}>{n}</p>; }
export default function App() { return <p />; }
`;
    const [warning] = compile(unused, '/src/c.tsx').diagnostics;
    expect(warning.span).toEqual({ start: 0, end: unused.indexOf('\n') });
  });
});

describe('a file with named components and no default export', () => {
  const TOOLS = `import type { JSX } from 'idlip/jsx-runtime';
export function Clock(props: { at: number }): JSX.Element {
  let at = props.at;
  function tick() { at = at + 1; }
  return <time on:click={tick}>{at}</time>;
}
export function Toggle(): JSX.Element {
  let on = false;
  function flip() { on = !on; }
  return <button on:click={flip}>{on ? 'on' : 'off'}</button>;
}
`;

  it('puts the first named component in the manifest and the others in components', () => {
    const result = compile(TOOLS, '/src/tools.tsx');
    expect(listErrors(result)).toEqual([]);
    expect(result.manifest.module).toBe('/src/tools.tsx#Clock');
    expect(result.client[0].chunk).toBe('handler=tick');
    expect(result.components?.map((item) => item.manifest.module)).toEqual([
      '/src/tools.tsx#Toggle',
    ]);
  });

  it('exports a record and a render function per component and no default', () => {
    const { server } = compile(TOOLS, '/src/tools.tsx');
    expect(server).not.toContain('export default');
    expect(server).not.toContain('export const manifest');
    expect(server).not.toContain('export const chunks');
    expect(server).toContain('export const $Clock = {');
    expect(server).toContain('export function Toggle(props, context, model)');
  });

  it('renders and resumes a named component as the page root', async () => {
    // `mount` renders the default export, so the test wraps the named one in it.
    const source = `${TOOLS}export default function Page(): JSX.Element { return <main><Toggle /></main>; }\n`;
    page = await mount(source, {}, { id: '/src/tools.tsx' });
    page.click('button');
    await page.settled();
    expect(page.text('button')).toBe('on');
    expect(page.loaded().toSorted()).toEqual(['Toggle.binding=on', 'Toggle.handler=flip']);
  });
});

describe('a child inside a condition', () => {
  it('adds a component of the same file when the condition turns true', async () => {
    const source = `import type { JSX } from 'idlip/jsx-runtime';
function Counter(props: { start: number }): JSX.Element {
  let count = props.start;
  function increment() { count = count + 1; }
  return <output on:click={increment}>{count}</output>;
}
export default function Panel(): JSX.Element {
  let open = false;
  function show() { open = !open; }
  return <main><button on:click={show}>Show</button>{open ? <Counter start={1} /> : null}</main>;
}
`;
    page = await mount(source, {}, { id: '/src/panel.tsx' });
    expect(page.root.querySelector('output')).toBeNull();
    page.click('button');
    await page.settled();
    expect(page.text('output')).toBe('1');
    expect(page.loaded()).toContain('Counter.view');
    page.click('output');
    await page.settled();
    expect(page.text('output')).toBe('2');
    expect(page.loaded().slice(-2).toSorted()).toEqual([
      'Counter.binding=count',
      'Counter.handler=increment',
    ]);
  });
});

describe('module ids with a # in the path', () => {
  it('keeps a # in a folder or file name as part of the file', () => {
    expect(getChunkId('/src/a#b/c.tsx', 'handler=x')).toBe(
      '/src/a#b/c.tsx?idlip-handler=x&lang.js',
    );
    expect(getChunkId('/src/A#B/c.tsx#Row', 'view')).toBe('/src/A#B/c.tsx?idlip-Row.view&lang.js');
    expect(getChunkId('/src/x#Y.tsx', 'list=1')).toBe('/src/x#Y.tsx?idlip-list=1&lang.js');
    expect(splitModule('/src/a#b/c.tsx')).toEqual({ file: '/src/a#b/c.tsx', name: undefined });
    expect(splitModule('/src/A#B/c.tsx#Row')).toEqual({ file: '/src/A#B/c.tsx', name: 'Row' });
    expect(splitModule('/src/x#Y.tsx')).toEqual({ file: '/src/x#Y.tsx', name: undefined });
  });
});
