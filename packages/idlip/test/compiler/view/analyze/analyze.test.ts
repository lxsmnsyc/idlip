/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { analyze, printModule, printPath } from '../../../../src/compiler/view/analyze/index.ts';
import type { Diagnostic, ModuleIR } from '../../../../src/compiler/view/analyze/index.ts';

// The fixtures are stored as `.txt`, so `tsc`, the linter and the formatter skip them:
// several of them do not type-check or do not parse on purpose.
const fixtures: Record<string, string | undefined> = import.meta.glob('./fixtures/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const recordedJson: Record<string, unknown> = import.meta.glob('./expected/*.json', {
  import: 'default',
  eager: true,
});

// Every rule id of the view-ir contract, with its severity.
const RULES: Record<string, 'error' | 'warning' | undefined> = {};
for (const rule of [
  'body-statement',
  'body-var',
  'body-destructure',
  'body-return',
  'props-count',
  'props-pattern',
  'props-whole',
  'hole-dynamic',
  'let-annotation',
  'let-bare-as',
  'let-init',
  'init-scope',
  'derived-jsx',
  'derived-cycle',
  'hole-closure',
  'hole-method',
  'hole-global',
  'hole-handler',
  'hole-statement',
  'hole-effect',
  'hole-unknown',
  'hole-operator',
  'hole-literal',
  'hole-object',
  'hole-array',
  'hole-spread',
  'hole-call',
  'hole-member',
  'hole-jsx',
  'hole-message',
  'hole-children',
  'hole-function-value',
  'hole-grammar',
  'helper-closure',
  'view-map',
  'condition-operator',
  'for-each',
  'for-key',
  'for-render',
  'for-param',
  'ref-form',
  'html-trusted',
  'html-children',
  'title-outside-head',
  'attr-jsx',
  'jsx-spread',
  'jsx-namespace-tag',
  'component-unknown',
  'component-import',
  'component-recursive',
  'child-children',
  'html-nesting',
  'html-implied',
  'event-closure',
  'event-target',
  'event-param',
  'event-mode-twice',
  'event-message-args',
  'event-placeholder',
  'event-passive-prevent',
  'attr-reserved',
  'html-raw-text',
  'try-catch',
  'subscribe-source',
  'subscribe-input-key',
  'subscribe-children',
  'global-attr',
  'global-children',
  'handler-free',
  'handler-assign',
  'handler-mutate',
  'handler-impure',
  'handler-generator',
  'await-placement',
  'await-callee',
  'parse',
]) {
  RULES[rule] = 'error';
}
RULES['let-unassigned'] = 'warning';
RULES['hole-impure'] = 'warning';

function readFixture(name: string): { file: string; source: string } {
  const source = fixtures[`./fixtures/${name}`];
  if (source === undefined) {
    throw new Error(`No fixture ${name}`);
  }
  return { file: name.replace(/\.txt$/, ''), source };
}

function analyzeFixture(name: string): { ir: ModuleIR; source: string } {
  const { file, source } = readFixture(name);
  return { ir: analyze(file, source), source };
}

function findLine(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) {
    if (source[index] === '\n') {
      line++;
    }
  }
  return line;
}

function listFixtures(): string[] {
  const names: string[] = [];
  for (const key of Object.keys(fixtures)) {
    names.push(key.slice('./fixtures/'.length));
  }
  return names.sort();
}

describe('contract fixtures', () => {
  for (const name of listFixtures()) {
    it(`prints the recorded IR for ${name}`, async () => {
      const { ir, source } = analyzeFixture(name);
      const base = name.replace(/\.idlip\.tsx\.txt$/, '');
      await expect(`${printModule(ir, source)}\n`).toMatchFileSnapshot(`./expected/${base}.txt`);
    });
  }

  for (const base of ['counter', 'todo']) {
    it(`produces the recorded JSON IR for ${base}`, () => {
      const { ir } = analyzeFixture(`${base}.idlip.tsx.txt`);
      const recorded = recordedJson[`./expected/${base}.json`];
      expect(recorded).toBeDefined();
      // The recorded JSON drops `undefined` fields, so compare the JSON forms.
      expect(JSON.parse(JSON.stringify(ir))).toEqual(recorded);
    });
  }

  it('gives the todo and the counter no diagnostics', () => {
    expect(analyzeFixture('todo.idlip.tsx.txt').ir.diagnostics).toEqual([]);
    expect(analyzeFixture('counter.idlip.tsx.txt').ir.diagnostics).toEqual([]);
  });

  it('never produces a dynamic hole', () => {
    for (const name of listFixtures()) {
      for (const component of analyzeFixture(name).ir.components) {
        for (const hole of component.holes) {
          expect(hole.paths).not.toBe('dynamic');
        }
      }
    }
  });
});

describe('rule ids', () => {
  const diagnostics: Diagnostic[] = [];
  for (const name of listFixtures()) {
    for (const diagnostic of analyzeFixture(name).ir.diagnostics) {
      diagnostics.push(diagnostic);
    }
  }

  it('reports only rule ids of the contract, with their severity', () => {
    for (const diagnostic of diagnostics) {
      expect(RULES[diagnostic.rule], diagnostic.rule).toBe(diagnostic.severity);
    }
  });

  for (const rule of Object.keys(RULES)) {
    // The analysis never produces a `dynamic` hole, and no source form gives `passive` in v9.
    if (rule === 'hole-dynamic' || rule === 'event-passive-prevent') {
      continue;
    }
    it(`fires ${rule}`, () => {
      let found = false;
      for (const diagnostic of diagnostics) {
        if (diagnostic.rule === rule) {
          found = true;
        }
      }
      expect(found).toBe(true);
    });
  }

  // A marker comment names a rule id; the rule must fire within the next lines. A stateless
  // component is inlined at its use, so its own errors are reported in its body.
  const reportedInBody = new Set(['props-whole', 'component-recursive']);
  for (const name of ['violations.idlip.tsx.txt', 'parse.idlip.tsx.txt', 'impure.idlip.tsx.txt']) {
    it(`fires each rule marked in ${name} next to its marker`, () => {
      const { ir, source } = analyzeFixture(name);
      const lines = source.split('\n');
      let markers = 0;
      for (const [index, text] of lines.entries()) {
        const match = /(?:\/\/|\/\*)\s*([a-z]+(?:-[a-z]+)*)(?=[:\s]|\*\/|$)/.exec(text);
        const rule = match?.[1];
        if (rule === undefined || RULES[rule] === undefined) {
          continue;
        }
        markers++;
        const line = index + 1;
        let near = false;
        for (const diagnostic of ir.diagnostics) {
          const at = findLine(source, diagnostic.span.start);
          if (diagnostic.rule !== rule) {
            continue;
          }
          if (reportedInBody.has(rule) || (at >= line && at <= line + 8)) {
            near = true;
          }
        }
        expect(near, `${rule} marked on line ${line}`).toBe(true);
      }
      expect(markers).toBeGreaterThan(0);
    });
  }
});

describe('event modifiers', () => {
  it('reads the block body forms of view-ir v9', () => {
    const { ir } = analyzeFixture('events.idlip.tsx.txt');
    const [form] = ir.components[0].view;
    if (form.kind !== 'element') {
      throw new Error('expected a form');
    }
    const found: unknown[] = [];
    found.push(form.events[0].modifiers);
    for (const child of form.children) {
      if (child.kind === 'element' && child.events.length > 0) {
        found.push(child.events[0].modifiers);
      }
    }
    expect(found).toEqual([
      [{ kind: 'prevent' }],
      [{ kind: 'stop' }, { kind: 'prevent' }],
      [{ kind: 'key', filter: 'Escape' }],
      [{ kind: 'key', filter: 'Enter' }],
      [{ kind: 'key', filter: 'Shift+Meta+s' }, { kind: 'prevent' }],
      [{ kind: 'key', filter: 'Ctrl+Alt+a' }, { kind: 'stop' }, { kind: 'prevent' }],
      [],
      [],
    ]);
    // `textarea` and `title` with one hole are allowed; only the `title` is outside `<Head>`.
    const rules: string[] = [];
    for (const diagnostic of ir.diagnostics) {
      rules.push(diagnostic.rule);
    }
    expect(rules).toEqual(['title-outside-head']);
  });
});

describe('the todo fixture of compiled-format', () => {
  const sources: Record<string, string | undefined> = import.meta.glob(
    '../../../fixtures/todo/todo.idlip.tsx',
    { query: '?raw', import: 'default', eager: true },
  );
  const source = Object.values(sources)[0] ?? '';

  it('analyzes with no diagnostics', async () => {
    const ir = analyze('todo.idlip.tsx', source);
    expect(ir.diagnostics).toEqual([]);
    await expect(`${printModule(ir, source)}\n`).toMatchFileSnapshot(
      './expected/compiled-format-todo.txt',
    );
  });
});

describe('the todo manifest', () => {
  const sources: Record<string, string | undefined> = import.meta.glob(
    '../../../fixtures/todo/todo.idlip.tsx',
    { query: '?raw', import: 'default', eager: true },
  );
  const manifests: Record<
    string,
    { groups: Record<string, { paths: string[]; bindings: string[] }> }
  > = import.meta.glob('../../../fixtures/todo/expected/manifest.json', {
    import: 'default',
    eager: true,
  });
  const source = Object.values(sources)[0] ?? '';
  const manifest = Object.values(manifests)[0];

  it('matches the hole ids and path sets of the analysis', () => {
    const component = analyze('todo.idlip.tsx', source).components[0];
    // Binding ids are the hole id after one letter; the event payload takes the next id.
    const paths = new Map<number, string[]>();
    for (const hole of component.holes) {
      expect(hole.paths).not.toBe('dynamic');
      const printed: string[] = [];
      for (const path of hole.paths === 'dynamic' ? [] : hole.paths) {
        printed.push(printPath(path));
      }
      paths.set(hole.id, printed);
    }
    paths.set(component.holes.length, ['todos.*.id']);
    let checked = 0;
    for (const group of Object.values(manifest.groups)) {
      for (const binding of group.bindings) {
        expect(paths.get(Number(binding.slice(1))), binding).toEqual(group.paths);
        checked++;
      }
    }
    expect(checked).toBe(paths.size);
  });
});

describe('impure globals in holes', () => {
  it('marks the call impure and warns only when the hole reads paths', () => {
    const { ir, source } = analyzeFixture('impure.idlip.tsx.txt');
    const component = ir.components.at(0);
    expect(component?.name).toBe('Impure');
    const warned: string[] = [];
    for (const diagnostic of ir.diagnostics) {
      if (diagnostic.rule === 'hole-impure') {
        warned.push(source.slice(diagnostic.span.start, diagnostic.span.end));
      }
    }
    expect(warned).toEqual(['props.seed + Math.random()', '`${count} at ${Date.now()}`']);
    expect(component?.holes.at(0)?.expr).toEqual({
      kind: 'call',
      callee: { kind: 'global', name: 'Math.random' },
      args: [],
      helper: 'args',
      impure: true,
    });
    expect(component?.holes.at(0)?.paths).toEqual([]);
  });
});

describe('imported components', () => {
  const files: Record<string, string | undefined> = {
    'badge.idlip.tsx': `export default function Badge(props: { label: string }) {
  return <b>{props.label}</b>;
}`,
    'widgets.idlip.tsx': `import { format } from './format';
export function Ticker() {
  let n = 0;
  function tick() {
    n = n + 1;
  }
  return <i on:click={tick}>{n}</i>;
}
function Shout(props: { text: string }) {
  return <em>{format(props.text)}</em>;
}
export { Shout };`,
  };

  function readImport(specifier: string): { file: string; source: string } | undefined {
    const file = specifier.replace(/^\.\//, '');
    const source = files[file];
    return source === undefined ? undefined : { file, source };
  }

  const app = `import Badge from './badge.idlip.tsx';
import { Ticker, Shout, Missing } from './widgets.idlip.tsx';
export default function App() {
  let title = 'x';
  function rename(next: string) {
    title = next;
  }
  return (
    <main>
      <Badge label={title} />
      <Ticker />
      <Shout text={title} />
      <Missing />
      <button on:click={() => rename('y')}>rename</button>
    </main>
  );
}`;

  it('inlines a stateless import, keeps a stateful one as a child and reports bad reads', () => {
    const ir = analyze('app.idlip.tsx', app, { readImport });
    const main = ir.components.at(0)?.view[0];
    expect(main?.kind).toBe('element');
    const kinds: string[] = [];
    if (main?.kind === 'element') {
      for (const child of main.children) {
        kinds.push(child.kind);
      }
    }
    // Badge inlines to <b>, Ticker is a child, Shout inlines to <em>, Missing is a child.
    expect(kinds).toEqual(['element', 'child', 'element', 'child', 'element']);
    expect(ir.components.at(0)?.holes[0]?.paths).toEqual([{ root: 'state', segments: ['title'] }]);
    const rules: string[] = [];
    for (const diagnostic of ir.diagnostics) {
      rules.push(diagnostic.rule);
      // Spans point into app.idlip.tsx, at the use of the component.
      expect(diagnostic.span.end).toBeLessThanOrEqual(app.length);
    }
    expect(rules).toEqual(['component-import', 'component-import']);
    expect(ir.diagnostics[0]?.message).toContain('widgets.idlip.tsx:10:');
    expect(ir.diagnostics[1]?.message).toContain('no component export named Missing');
  });

  it('keeps every imported component a child without a reader', () => {
    const ir = analyze('app.idlip.tsx', app);
    expect(ir.diagnostics).toEqual([]);
    const main = ir.components.at(0)?.view[0];
    const kinds: string[] = [];
    if (main?.kind === 'element') {
      for (const child of main.children) {
        kinds.push(child.kind);
      }
    }
    expect(kinds).toEqual(['child', 'child', 'child', 'child', 'element']);
  });
});

describe('props paths before a called method', () => {
  const head = `import type { JSX } from 'idlip/jsx-runtime';\n`;

  function readProps(source: string): string[] {
    const ir = analyze('a.idlip.tsx', head + source);
    expect(ir.diagnostics).toEqual([]);
    const out: string[] = [];
    for (const entry of ir.components[0].handlers[0].free) {
      for (const path of entry.paths) {
        out.push(printPath(path));
      }
    }
    return out;
  }

  it('stops at the receiver of a method call', () => {
    expect(
      readProps(`export default function A(props: { list: string[] }): JSX.Element {
  let at = -1;
  function find(by: string) { at = props.list.indexOf(by); }
  return <button on:click={() => find('b')}>{at}</button>;
}`),
    ).toEqual(['props.list']);
    expect(
      readProps(`export default function A({ list }: { list: string[] }): JSX.Element {
  let at = -1;
  function find(by: string) { at = list.indexOf(by); }
  return <button on:click={() => find('b')}>{at}</button>;
}`),
    ).toEqual(['props.list']);
    expect(
      readProps(`export default function A(props: { user: { tags: string[] } }): JSX.Element {
  let n = 0;
  function count() { n = props.user.tags.map((t) => t).length; }
  return <button on:click={() => count()}>{n}</button>;
}`),
    ).toEqual(['props.user.tags']);
  });
});

describe('JSX attribute entities', () => {
  it('decodes a string attribute and leaves a braced string alone', () => {
    const source = `export default function A(): JSX.Element {
  return <p title="a &amp; b &#65;" id={'a &amp; b'}>x</p>;
}`;
    const ir = analyze('a.idlip.tsx', source);
    expect(ir.components[0].view).toMatchObject([
      {
        kind: 'element',
        attrs: [
          { name: 'title', value: { kind: 'static', value: 'a & b A' } },
          { name: 'id', value: { kind: 'static', value: 'a &amp; b' } },
        ],
      },
    ]);
  });
});

describe('JSX text entities', () => {
  it('decodes named, numeric and hex entities in text', () => {
    const source = `export default function A(): JSX.Element {
  return <p>a &lt; b &amp; c&nbsp;d &#65;&#x42; &unknown;</p>;
}`;
    const ir = analyze('a.idlip.tsx', source);
    expect(ir.components[0].view).toMatchObject([
      { kind: 'element', children: [{ kind: 'text', value: 'a < b & c d AB &unknown;' }] },
    ]);
  });
});
