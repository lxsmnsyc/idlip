// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { mount } from '../../../src/testing/index.ts';
import type { MountedPage } from '../../../src/testing/index.ts';

const SOURCE = readFileSync(join(import.meta.dirname, '../../fixtures/form/form.tsx'), 'utf8');

let page: MountedPage | undefined;

afterEach(() => {
  page?.stop();
  page = undefined;
});

describe('form fields in an event arrow', () => {
  it('writes the field paths into the message and the prevent modifier', () => {
    const { server } = compile(SOURCE, '/src/app.tsx');
    expect(server).toContain('["$event","currentTarget","elements","draft","value"]');
    expect(server).toContain('["$event","currentTarget","elements","amount","valueAsNumber"]');
    expect(server).toContain('"prevent"');
  });

  it('reads the fields at dispatch and prevents the submit', async () => {
    page = await mount(SOURCE, {}, { check: false });
    const form = page.get('form');
    const draft = page.get('input[name=draft]');
    const amount = page.get('input[name=amount]');
    const agree = page.get('input[name=agree]');
    if (
      !(draft instanceof HTMLInputElement) ||
      !(amount instanceof HTMLInputElement) ||
      !(agree instanceof HTMLInputElement)
    ) {
      throw new Error('Expected inputs');
    }
    draft.value = 'milk';
    amount.value = '5';
    agree.checked = true;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await page.settled();
    const paragraphs = page.root.querySelectorAll('p');
    expect(paragraphs[0]?.textContent).toBe('milk');
    expect(paragraphs[1]?.textContent).toBe('5');
    expect(paragraphs[2]?.textContent).toBe('yes');
  });

  it('reads a field of a form in a row, with the row key in the payload', async () => {
    page = await mount(SOURCE, {}, { check: false });
    const second = page.root.querySelectorAll('li input')[1];
    if (!(second instanceof HTMLInputElement)) {
      throw new Error('Expected a row input');
    }
    second.value = 'zwei';
    second.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await page.settled();
    expect(page.root.querySelectorAll('p')[3]?.textContent).toBe('a2:zwei');
  });

  it('leaves a forwarded message prop to the parent modifiers', () => {
    const forwarded = `
import type { JSX } from 'idlip/jsx-runtime';

export default function Form(props: { onSend: () => void }): JSX.Element {
  return <form on:submit={props.onSend}><button>Go</button></form>;
}
`;
    const { diagnostics } = compile(forwarded, '/src/app.tsx');
    expect(diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
  });

  it('rejects a computed key', () => {
    const bad = SOURCE.replace('elements.draft.value', 'elements[name].value').replace(
      'let notes',
      "const name = 'draft';\n  let notes",
    );
    const { diagnostics } = compile(bad, '/src/app.tsx');
    expect(diagnostics.map((item) => item.rule)).toContain('event-computed-key');
  });
});
