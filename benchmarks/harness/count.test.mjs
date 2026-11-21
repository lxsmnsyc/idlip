// Run with `pnpm -C benchmarks/harness test`. It renders the idlip page for 3 todos, loads it
// into a DOM and runs the functions that the browser metric runs in the page.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import { prepareLeft, toggleDone } from './browser.mjs';
import { COUNT_ARG, readCount } from './count.mjs';
import { loadApp } from './frameworks.mjs';

async function load() {
  const app = await loadApp('idlip');
  const window = new Window();
  window.document.body.innerHTML = await app.render(3);
  globalThis.window = window;
  globalThis.document = window.document;
  return window;
}

test('the page body runs the last title into the count', async () => {
  const window = await load();
  assert.equal(/(\d+) left/.exec(window.document.body.textContent)?.[1], '32');
});

test('prepareLeft reads 2 for 3 todos', async () => {
  const window = await load();
  prepareLeft(COUNT_ARG);
  assert.equal(window.__left, 2);
});

test('toggleDone is true after the second todo is toggled', async () => {
  const window = await load();
  prepareLeft(COUNT_ARG);
  assert.equal(toggleDone(COUNT_ARG), false);
  window.document.querySelectorAll('ul li')[1].className = 'done';
  window.document.querySelector('ul + p').textContent = '1 left';
  assert.equal(toggleDone(COUNT_ARG), true);
});

test('readCount ignores text outside the count element', () => {
  const window = new Window();
  window.document.body.innerHTML = '<ul><li>Todo number 3</li></ul><p>2 left</p>';
  assert.equal(readCount(window.document), 2);
  window.document.body.innerHTML = '<p>Todo number 32 left</p>';
  assert.equal(readCount(window.document), undefined);
});
