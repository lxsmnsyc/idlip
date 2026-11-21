// The rows and dashboard pages of idlip render what the browser checks expect. Needs
// `pnpm --filter idlip build`, `pnpm -C benchmarks/idlip build:rows` and `build:dashboard` first.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expected, widgets } from './dashboard.mjs';
import { hasScenario, loadApp } from './frameworks.mjs';
import { label } from './rows.mjs';

function countMatches(text, pattern) {
  let count = 0;
  for (const _ of text.matchAll(pattern)) {
    count++;
  }
  return count;
}

test('only apps with a build script for a scenario take part in it', async () => {
  assert.equal(await hasScenario('idlip', 'rows'), true);
  assert.equal(await hasScenario('idlip', 'dashboard'), true);
  assert.equal(await hasScenario('qwik1', 'rows'), false);
  assert.equal(await hasScenario('qwik1', 'todos'), true);
});

test('the idlip rows page renders every row with its ID and label', async () => {
  const app = await loadApp('idlip', 'rows');
  const html = await app.render(1000);
  assert.equal(countMatches(html, /<tr\b/g), 1000);
  assert.ok(html.includes(label(1)));
  assert.ok(html.includes(label(1000)));
  assert.equal(countMatches(await app.render(0), /<tr\b/g), 0);
});

test('the idlip dashboard page renders every widget in its first mode', async () => {
  const html = await (await loadApp('idlip', 'dashboard')).render();
  for (const widget of widgets()) {
    assert.ok(html.includes(`id="${widget.id}"`), widget.id);
    assert.ok(html.includes(widget.title), widget.title);
    assert.ok(html.includes(widget.modes[0]), `${widget.id} mode`);
  }
  // The click checks compare with the handler run in Node, which must change the output.
  assert.notEqual(expected(widgets()[1], 'run').output, 'Ready');
});
