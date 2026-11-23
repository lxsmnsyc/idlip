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
  it('reads the field paths in the event function and marks the submit as prevented', () => {
    const { server, client } = compile(SOURCE, '/src/app.tsx');
    expect(server).toMatch(/on:submit="\$e\d+ prevent"/);
    expect(server).not.toContain('$event');
    let code = '';
    for (const module of client) {
      code += module.code;
    }
    expect(code).toContain('$c.elements.draft.value');
    expect(code).toContain('$c.elements.amount.valueAsNumber');
  });

  it('reads the fields when the function runs and prevents the submit', async () => {
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

  it('reads a computed key in the event function', () => {
    const source = SOURCE.replace('elements.draft.value', 'elements[name].value').replace(
      'let notes',
      "const name = 'draft';\n  let notes",
    );
    const { diagnostics, client } = compile(source, '/src/app.tsx');
    expect(diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    let code = '';
    for (const module of client) {
      code += module.code;
    }
    expect(code).toContain("$c.elements['draft'].value");
  });
});
