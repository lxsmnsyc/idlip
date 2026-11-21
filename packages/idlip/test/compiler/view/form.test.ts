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
  const { server, diagnostics } = compile(source, '/src/app.idlip.tsx');
  const failed = diagnostics.filter((item) => item.severity === 'error');
  return failed.length > 0 ? failed.map((item) => item.rule).join(',') : server;
}

describe('form fields', () => {
  it('adds prevent to a submit arrow', () => {
    const out = render('(e) => add(e.currentTarget.elements.draft.value)');
    expect(out).toContain('"prevent"');
  });

  it('does not add prevent twice', () => {
    const out = render('(e) => { e.preventDefault(); add(e.currentTarget.elements.draft.value); }');
    expect(out.match(/prevent/g)).toHaveLength(1);
  });

  it('rejects a computed key on the event path', () => {
    const out = render('(e) => add(e.currentTarget.elements[draft].value)');
    expect(out).toContain('event-computed-key');
  });
});
