import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';

function render(arrow: string): string {
  const source = `
import type { JSX } from 'idlip/jsx-runtime';

export default function Form(): JSX.Element {
  let draft = '';
  function add(text: string) {
    draft = text;
  }
  return (
    <form on:submit={${arrow}}>
      <input name="draft" />
    </form>
  );
}
`;
  const { server, diagnostics } = compile(source, '/src/app.tsx');
  const failed = diagnostics.filter((item) => item.severity === 'error');
  return failed.length > 0 ? failed.map((item) => item.rule).join(',') : server;
}

describe('form fields', () => {
  it('adds prevent to a submit arrow', () => {
    const out = render('(e) => add(e.currentTarget.elements.draft.value)');
    expect(out).toContain('on:submit="$e0 prevent"');
  });

  it('does not add prevent twice', () => {
    const out = render('(e) => { e.preventDefault(); add(e.currentTarget.elements.draft.value); }');
    expect(out.match(/prevent/g)).toHaveLength(1);
    expect(out).toContain('on:submit="$e0 prevent"');
  });

  it('reads a computed key of the event path in the event function', () => {
    const source = `
import type { JSX } from 'idlip/jsx-runtime';

export default function Form(): JSX.Element {
  let draft = 'draft';
  function add(text: string) {
    draft = text;
  }
  return (
    <form on:submit={(e) => add(e.currentTarget.elements[draft].value)}>
      <input name="draft" />
    </form>
  );
}
`;
    const { client, diagnostics } = compile(source, '/src/app.tsx');
    expect(diagnostics).toEqual([]);
    const handler = client.find((module) => module.chunk === 'handler=add');
    expect(handler?.code).toContain('$c.elements[model.draft].value');
  });
});
