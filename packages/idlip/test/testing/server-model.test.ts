// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { mount } from '../../src/testing/index.ts';

const TODO = readFileSync(join(import.meta.dirname, '../fixtures/todo/todo.tsx'), 'utf8');

describe('server render from a model', () => {
  it('emits a third parameter that replaces the initial state', () => {
    const { server } = compile(TODO, '/src/todo.tsx');
    expect(server).toContain('export default function TodoApp(props, context, model)');
    expect(server).toContain('model === undefined ?');
  });

  it('renders props without a model and the model when given one', async () => {
    const initial = [{ id: 'a1', text: 'One', done: false }];
    const page = await mount(TODO, { initial });
    expect(page.text('p')).toBe('1 left');
    // The check renders the new model on the server and fails if the page disagrees.
    page.click('li input');
    await page.settled();
    expect(page.text('p')).toBe('0 left');
    page.stop();
  });
});
